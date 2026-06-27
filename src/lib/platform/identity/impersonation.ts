import { cookies } from "next/headers";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { IMPERSONATION_COOKIE } from "@/lib/platform/identity/context";
import { logSecurityEvent } from "@/lib/platform/identity/security";
import { requirePermission } from "@/lib/platform/identity/permissions";

export async function startImpersonation(targetUserId: string, reason: string, ipAddress?: string) {
  const supabase = await createAuthClient();
  const gate = await requirePermission(supabase, "impersonate.users");
  if (!gate.ok) return { error: gate.error };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  if (user.id === targetUserId) return { error: "Cannot impersonate yourself" };

  await supabase
    .from("platform_impersonation_sessions")
    .update({ is_active: false, ended_at: new Date().toISOString() })
    .eq("actor_user_id", user.id)
    .eq("is_active", true);

  const { data: session, error } = await supabase
    .from("platform_impersonation_sessions")
    .insert({
      actor_user_id: user.id,
      target_user_id: targetUserId,
      reason,
      ip_address: ipAddress ?? null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logSecurityEvent(supabase, {
    eventType: "impersonation_start",
    userId: targetUserId,
    actorUserId: user.id,
    ipAddress,
    summary: `Impersonation started`,
    metadata: { reason, sessionId: session.id },
  });

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 4,
  });

  return { success: true, sessionId: session.id };
}

export async function endImpersonation() {
  const supabase = await createAuthClient();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(IMPERSONATION_COOKIE)?.value;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  if (sessionId) {
    const { data: session } = await supabase
      .from("platform_impersonation_sessions")
      .select("target_user_id")
      .eq("id", sessionId)
      .eq("actor_user_id", user.id)
      .maybeSingle();

    await supabase
      .from("platform_impersonation_sessions")
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq("id", sessionId);

    if (session) {
      await logSecurityEvent(supabase, {
        eventType: "impersonation_end",
        userId: session.target_user_id,
        actorUserId: user.id,
        summary: "Impersonation ended",
        metadata: { sessionId },
      });
    }

    cookieStore.delete(IMPERSONATION_COOKIE);
  }

  return { success: true };
}

export async function getImpersonationHistory(limit = 50) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("platform_impersonation_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}
