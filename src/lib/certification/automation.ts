import type { createAuthClient } from "@/lib/supabase/server-auth";
import { runNightlyHealthScan } from "@/lib/certification/certification-engine";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

/** Nightly certification health scan — platform, schools, finance, compliance, automation, scheduling, SSIS, cloud */
export async function syncCertificationPlatform(supabase: AuthClient) {
  const hour = new Date().getUTCHours();
  if (hour !== 2) return;
  await runNightlyHealthScan(supabase);
}
