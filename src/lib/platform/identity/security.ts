import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { SecurityEventSummary } from "@/lib/platform/identity/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface LogSecurityEventInput {
  eventType:
    | "failed_login"
    | "permission_change"
    | "role_assignment"
    | "role_removal"
    | "impersonation_start"
    | "impersonation_end"
    | "export"
    | "sensitive_access"
    | "org_assignment_change"
    | "school_config_change"
    | "record_unlock"
    | "approval_submitted"
    | "approval_decided"
    | "classification_change";
  summary: string;
  userId?: string | null;
  actorUserId?: string | null;
  schoolId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logSecurityEvent(supabase: AuthClient, input: LogSecurityEventInput) {
  await supabase.from("platform_security_events").insert({
    event_type: input.eventType,
    user_id: input.userId ?? null,
    actor_user_id: input.actorUserId ?? null,
    school_id: input.schoolId ?? null,
    ip_address: input.ipAddress ?? null,
    summary: input.summary,
    metadata: input.metadata ?? {},
  });
}

export async function getSecurityDashboardStats(supabase: AuthClient): Promise<SecurityEventSummary> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data } = await supabase
    .from("platform_security_events")
    .select("event_type")
    .gte("created_at", since);

  const counts: SecurityEventSummary = {
    failedLogins: 0,
    permissionChanges: 0,
    roleAssignments: 0,
    impersonations: 0,
    exports: 0,
    sensitiveAccess: 0,
  };

  for (const row of data ?? []) {
    switch (row.event_type) {
      case "failed_login":
        counts.failedLogins++;
        break;
      case "permission_change":
        counts.permissionChanges++;
        break;
      case "role_assignment":
      case "role_removal":
        counts.roleAssignments++;
        break;
      case "impersonation_start":
      case "impersonation_end":
        counts.impersonations++;
        break;
      case "export":
        counts.exports++;
        break;
      case "sensitive_access":
        counts.sensitiveAccess++;
        break;
    }
  }

  return counts;
}

export async function getRecentSecurityEvents(supabase: AuthClient, limit = 50) {
  const { data } = await supabase
    .from("platform_security_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}
