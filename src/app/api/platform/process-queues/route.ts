import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { processAllPlatformQueues } from "@/lib/platform/automation/process-queues";
import { guardApiRoute } from "@/lib/platform/identity/api-guard";

async function authorizeCron(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  const supabase = await createAuthClient();

  if (!(await authorizeCron(req))) {
    const gate = await guardApiRoute(supabase, "mission_control.access");
    if (gate instanceof NextResponse) return gate;
  }

  await processAllPlatformQueues(supabase);
  return NextResponse.json({ success: true, processedAt: new Date().toISOString() });
}

export async function GET(req: Request) {
  return POST(req);
}
