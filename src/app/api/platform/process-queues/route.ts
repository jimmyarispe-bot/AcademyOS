import { NextResponse } from "next/server";

import { guardApiRoute } from "@/lib/platform/identity/api-guard";
import {
  processAllPlatformQueues,
  type PlatformQueueRunSummary,
} from "@/lib/platform/automation/process-queues";
import { authorizeBearerSecret } from "@/lib/security/timing-safe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { createAuthClient } from "@/lib/supabase/server-auth";

/**
 * The nightly job runner.
 *
 * THE BUG THIS FIXES.
 *
 * This route authorised the cron with CRON_SECRET and then did all of its work
 * through a COOKIE-BOUND Supabase client. A cron request carries no cookies, so
 * that client had no user — and every queue it drains is protected by policies
 * like `using (can_access_school(...))`, which is false with no session.
 *
 * So the nightly run selected zero rows everywhere, found nothing to do, and
 * answered `{success: true}`. No error, nothing logged, because from the code's
 * point of view the queues were simply empty. The house pattern: zero rows with
 * no error is a policy refusal wearing a success costume.
 *
 * Everything on this runner was affected — the admissions workflow and
 * communication queues, tour reminders, medical document expiry alerts,
 * disengaged-family detection, attendance notifications, SPED review reminders,
 * finance and instruction reminders, and every nightly sync and snapshot.
 *
 * THE FIX, AND ITS LIMIT.
 *
 * A machine caller gets the service-role client, which bypasses RLS. That is
 * correct for a system job — nobody is logged in, and the work is not on any
 * one person's behalf — and it is also the most dangerous client in the
 * codebase, so it is granted ONLY on the CRON_SECRET path. A human who triggers
 * this from Mission Control still runs as themselves, under their own
 * permissions, exactly as before.
 *
 * AND IT NOW SAYS WHAT IT DID.
 *
 * The old response could not distinguish "drained every queue" from "found
 * nothing anywhere", which is why this went unnoticed for months. Each run
 * records how many jobs ran, how long it took, and which failed — into
 * platform_job_runs, so the answer survives the request.
 */

async function authorizeCron(req: Request): Promise<boolean> {
  return authorizeBearerSecret(
    req.headers.get("authorization"),
    process.env.CRON_SECRET
  );
}

/**
 * Record the run.
 *
 * Deliberately swallowed: the work is already done by the time this is called,
 * and failing to write the log must not turn a successful night into a 500 that
 * makes Vercel retry everything. A missing row is a gap in the record; a
 * re-run is duplicated work against live data.
 */
/**
 * The two clients are differently typed — one carries the generated Database
 * types, the other does not — and a union of them has no callable `from`. This
 * asks for the one method it uses and nothing else, which is also an accurate
 * description of what recording a run requires.
 */
type InsertOnlyClient = {
  from: (table: string) => {
    // Resolves to { error }, not to unknown: the whole point of this type is
    // that a refused insert is a VALUE, not a thrown exception.
    insert: (
      row: Record<string, unknown>
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
};

async function recordRun(
  supabase: InsertOnlyClient,
  triggeredBy: "cron" | "human",
  summary: PlatformQueueRunSummary
) {
  try {
    // The RETURNED error, not just a thrown one. supabase-js does not throw on
    // an RLS refusal -- it resolves with { error }. A try/catch alone therefore
    // catches nothing and the row silently never appears: the exact failure
    // this table was created to expose.
    const { error } = await supabase.from("platform_job_runs").insert({
      triggered_by: triggeredBy,
      jobs_run: summary.jobsRun,
      failure_count: summary.failures.length,
      duration_ms: summary.durationMs,
      failures: summary.failures,
    });
    if (error) {
      console.error("[process-queues] run completed but could not be recorded", {
        triggeredBy,
        error: error.message,
      });
    }
  } catch (error) {
    console.error("[process-queues] run completed but could not be recorded", {
      triggeredBy,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * THE WALL CLOCK, WHICH IS WHY NONE OF THIS EVER RAN.
 *
 * A Vercel serverless function defaults to 10 SECONDS on the Hobby plan. This
 * route runs thirty-odd jobs against live data in a single invocation. It never
 * finished, so it never reached recordRun, so platform_job_runs stayed empty and
 * the nightly cron failed silently every night — returning 504 to a caller that
 * was a scheduler and therefore had nobody to tell.
 *
 * That is the real reason the admissions pipeline has never sent an email. The
 * cookie-client identity bug found on 6 September was real, and was the SECOND
 * problem, sitting behind a request that was being killed before it mattered.
 *
 * 60 is the Hobby ceiling. If runs start hitting it again — the button on
 * /dashboard/admissions/automation reports the duration, so this is observable —
 * the answer is not a bigger number. It is to stop running thirty jobs in one
 * request: give each wave its own invocation, or move to a queue that processes
 * a bounded batch per call.
 */
export const maxDuration = 60;

export async function POST(req: Request) {
  const isCron = await authorizeCron(req);

  if (!isCron) {
    const cookieClient = await createAuthClient();
    const gate = await guardApiRoute(cookieClient, "mission_control.access");
    if (gate instanceof NextResponse) return gate;

    const summary = await processAllPlatformQueues(cookieClient);
    // The jobs run as the human -- that part is deliberate. The LOG ROW does
    // not: platform_job_runs (289) has a read policy and no insert policy,
    // because the only writer was meant to be the service role. Writing it with
    // the cookie client was refused by RLS on every human-triggered run, and
    // silently, so the table stayed empty and looked like "the cron never
    // fired". Who ran it is carried by triggered_by, not by whose connection
    // inserts the row.
    await recordRun(
      createServiceRoleClient() as unknown as InsertOnlyClient,
      "human",
      summary
    );
    return NextResponse.json({
      success: true,
      triggeredBy: "human",
      processedAt: new Date().toISOString(),
      ...summary,
    });
  }

  // Machine caller. No session exists to inherit, so the service role is the
  // only identity under which these queues are visible at all.
  const serviceClient = createServiceRoleClient();
  const summary = await processAllPlatformQueues(serviceClient);
  await recordRun(serviceClient as unknown as InsertOnlyClient, "cron", summary);

  if (summary.failures.length > 0) {
    console.error("[process-queues] jobs failed", summary.failures);
  }

  // Nobody watches a 3am cron run in a browser, so the timings have to reach
  // the log or they may as well not be measured. Ten slowest is enough to see
  // where a night went.
  console.log(
    "[process-queues] slowest jobs",
    summary.timings.slice(0, 10).map((t) => `${t.name} ${t.ms}ms${t.ok ? "" : " FAILED"}`)
  );

  return NextResponse.json({
    success: true,
    triggeredBy: "cron",
    processedAt: new Date().toISOString(),
    ...summary,
  });
}

export async function GET(req: Request) {
  return POST(req);
}
