/**
 * RC11 background workers — invoked from processAllPlatformQueues.
 */
import { sendTransactionalEmail } from "@/lib/platform/email/send";
import { processDueInfoRequests } from "@/lib/people/info-requests";
import type { createAuthClient } from "@/lib/supabase/server-auth";
import { ensureProductionIntegrationsRegistered } from "./integrations";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function processJagPipelineWorker(supabase: AuthClient) {
  const { insightApi } = await import("@/lib/jag-intelligence/api");

  // THE TABLE IS org_organizations, NOT organizations.
  //
  // This read named a relation that does not exist. PostgREST answers that with
  // an ERROR, not with rows -- and the error was discarded, so `orgs` came back
  // null, the !orgs?.length branch below caught it, and the pipeline has run
  // ONCE AND UNSCOPED for as long as this file has existed, returning
  // { runs: 1 } and looking entirely successful.
  //
  // The fallback is what hid it. A branch meant for "this deployment has no
  // organizations yet" quietly became the only branch, and reported the same
  // shape either way. So the error is checked now: a missing table is loud, and
  // the fallback runs only when there genuinely are no organizations.
  const { data: orgs, error } = await supabase
    .from("org_organizations")
    .select("id")
    .limit(5);

  if (error) {
    console.error("[rc11] could not list organizations", error.message);
    return { runs: 0 };
  }

  if (!orgs?.length) {
    await insightApi.runPipeline(supabase, {});
    return { runs: 1 };
  }
  let runs = 0;
  for (const org of orgs) {
    await insightApi.runPipeline(supabase, { organizationId: org.id });
    runs += 1;
  }
  return { runs };
}

export async function processFounderInsightSnapshots(supabase: AuthClient) {
  const { composeFounderDashboard } = await import("@/lib/founder-intelligence/compose");
  const { data: schools } = await supabase.from("schools").select("id").limit(10);
  let snapshots = 0;
  if (!schools?.length) {
    await composeFounderDashboard(supabase, { seedDecisions: false });
    return { snapshots: 1 };
  }
  for (const school of schools) {
    await composeFounderDashboard(supabase, {
      schoolId: school.id,
      seedDecisions: false,
    });
    snapshots += 1;
  }
  return { snapshots };
}

export async function processCertificationReminderWorker(supabase: AuthClient) {
  const { emitCertificationExpiringAlerts } = await import(
    "@/lib/hr-platform/certifications"
  );
  const count = await emitCertificationExpiringAlerts(supabase, { withinDays: 90 });
  return { alerts: count };
}

export async function processFinancialAgingWorker(supabase: AuthClient) {
  try {
    const { snapshotAging } = await import("@/lib/finance-platform/aging");
    const { data: schools } = await supabase.from("schools").select("id").limit(10);
    if (!schools?.length) {
      return { ok: true, mode: "noop" as const, reason: "no_schools" };
    }
    let snapshots = 0;
    for (const school of schools) {
      await snapshotAging(supabase, { schoolId: school.id });
      snapshots += 1;
    }
    return { ok: true, mode: "snapshot" as const, snapshots };
  } catch (error) {
    return {
      ok: false,
      mode: "error" as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function processHealthSnapshotWorker(supabase: AuthClient) {
  const { runJagIntelligencePipeline } = await import("@/lib/jag-intelligence/pipeline");
  const result = await runJagIntelligencePipeline(supabase, {
    persistInsights: false,
    persistGraph: false,
  });
  try {
    await supabase.from("jag_context_snapshots").insert({
      organization_id: null,
      school_id: null,
      context: result.context,
    });
  } catch {
    // table may reject null org depending on RLS — best-effort
  }
  return { score: result.context.financialHealthScore };
}

/**
 * This worker used to mark queued communications `sent` without contacting any
 * email provider. Every row it touched became a lie: the record said the family
 * had been written to, and nothing had left the building.
 *
 * It now sends. Each row goes to its recipients through the configured provider;
 * a row whose send fails is marked `failed` with the reason rather than `sent`,
 * and its recipient rows are updated to match instead of being left `pending`
 * under a parent claiming success.
 */
export async function processNotificationDeliveryWorker(supabase: AuthClient) {
  const { data } = await supabase
    .from("platform_communications")
    .select("id, subject, body_html, body_text, type")
    .eq("status", "queued")
    .limit(25);

  const rows = (data ?? []) as Record<string, any>[];
  if (!rows.length) return { delivered: 0, failed: 0 };

  let delivered = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const row of rows) {
    const { data: recipients } = await supabase
      .from("platform_communication_recipients")
      .select("id, email")
      .eq("communication_id", row.id);

    const addresses = (recipients ?? [])
      .map((r) => (r as Record<string, any>).email)
      .filter((e): e is string => typeof e === "string" && e.includes("@"));

    if (!addresses.length) {
      await supabase
        .from("platform_communications")
        .update({ status: "failed", failed_at: now, failure_reason: "No email recipients" })
        .eq("id", row.id);
      failed += 1;
      continue;
    }

    const result = await sendTransactionalEmail({
      to: addresses,
      subject: String(row.subject ?? "(no subject)"),
      body: String(row.body_html ?? row.body_text ?? ""),
      text: row.body_text ? String(row.body_text) : undefined,
      kind: "system_notification",
    });

    if (result.success) {
      await supabase
        .from("platform_communications")
        .update({ status: "sent", sent_at: now })
        .eq("id", row.id);
      await supabase
        .from("platform_communication_recipients")
        .update({ delivery_status: "sent" })
        .eq("communication_id", row.id);
      delivered += 1;
    } else {
      await supabase
        .from("platform_communications")
        .update({
          status: "failed",
          failed_at: now,
          failure_reason: result.error ?? `Provider ${result.provider}`,
        })
        .eq("id", row.id);
      await supabase
        .from("platform_communication_recipients")
        .update({ delivery_status: "failed" })
        .eq("communication_id", row.id);
      failed += 1;
    }
  }

  return { delivered, failed };
}

/** Chase the parents who still owe us details. */
export async function processParentInfoRequestWorker(supabase: AuthClient) {
  return processDueInfoRequests(supabase);
}

export async function processScheduledTriggerWorker(supabase: AuthClient) {
  const { processScheduledWorkflowTriggers } = await import(
    "@/lib/workflows/scheduler"
  );
  return processScheduledWorkflowTriggers(supabase);
}

/** Wave entry for process-queues */
export async function processRc11ProductionWorkers(supabase: AuthClient) {
  ensureProductionIntegrationsRegistered();
  const results: Record<string, unknown> = {};
  const jobs: Array<[string, () => Promise<unknown>]> = [
    ["jag.pipeline", () => processJagPipelineWorker(supabase)],
    ["founder.snapshots", () => processFounderInsightSnapshots(supabase)],
    ["hr.certReminders", () => processCertificationReminderWorker(supabase)],
    ["finance.aging", () => processFinancialAgingWorker(supabase)],
    ["health.snapshots", () => processHealthSnapshotWorker(supabase)],
    ["notifications.delivery", () => processNotificationDeliveryWorker(supabase)],
    ["parent.info_requests", () => processParentInfoRequestWorker(supabase)],
    ["workflows.scheduled", () => processScheduledTriggerWorker(supabase)],
  ];

  for (const [name, run] of jobs) {
    try {
      results[name] = await run();
    } catch (error) {
      results[name] = {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return results;
}
