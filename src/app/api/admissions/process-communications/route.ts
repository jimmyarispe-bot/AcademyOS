import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { processCommunicationQueue } from "@/lib/admissions/communications/engine";
import { processWorkflowQueue } from "@/lib/admissions/automation/queue";
import { guardApiRoute } from "@/lib/platform/identity/api-guard";

export async function POST() {
  const supabase = await createAuthClient();
  const gate = await guardApiRoute(supabase, "admissions.manage");
  if (gate instanceof NextResponse) return gate;

  await processWorkflowQueue(supabase);
  await processCommunicationQueue(supabase);
  return NextResponse.json({ success: true });
}

export async function GET() {
  return POST();
}
