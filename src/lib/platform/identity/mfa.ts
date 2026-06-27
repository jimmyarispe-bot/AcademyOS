/**
 * 24 — MFA architecture readiness (no enforcement yet).
 * Tables: user_mfa_settings. Future: wire to Supabase Auth MFA or custom provider.
 */

import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { MfaMethod } from "@/lib/platform/identity/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface MfaSettings {
  user_id: string;
  mfa_required: boolean;
  preferred_method: MfaMethod | null;
  totp_enabled: boolean;
  sms_enabled: boolean;
  email_verification_enabled: boolean;
  passkey_enabled: boolean;
}

export const MFA_EXECUTIVE_ROLES = ["FOUNDER", "CEO", "EXECUTIVE_DIRECTOR", "FINANCE", "HR"] as const;

export async function getMfaSettings(supabase: AuthClient, userId: string) {
  const { data } = await supabase
    .from("user_mfa_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return data as MfaSettings | null;
}

/** Future sprint: enforce before sensitive actions */
export async function isMfaRequiredForUser(
  supabase: AuthClient,
  userId: string,
  roles: string[]
): Promise<boolean> {
  const settings = await getMfaSettings(supabase, userId);
  if (settings?.mfa_required) return true;
  return roles.some((r) => MFA_EXECUTIVE_ROLES.includes(r as (typeof MFA_EXECUTIVE_ROLES)[number]));
}

export async function markMfaMethodEnabled(
  supabase: AuthClient,
  userId: string,
  method: MfaMethod
) {
  const patch: Partial<MfaSettings> = { user_id: userId };
  if (method === "totp") patch.totp_enabled = true;
  if (method === "sms") patch.sms_enabled = true;
  if (method === "email") patch.email_verification_enabled = true;
  if (method === "passkey") patch.passkey_enabled = true;

  await supabase.from("user_mfa_settings").upsert({
    user_id: userId,
    preferred_method: method,
    ...patch,
    updated_at: new Date().toISOString(),
  });
}
