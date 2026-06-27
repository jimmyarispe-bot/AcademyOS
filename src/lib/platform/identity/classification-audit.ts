import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function logSensitiveAccess(
  supabase: AuthClient,
  input: {
    recordType: string;
    entityType: string;
    entityId: string;
    classification?: string;
    accessAction?: "view" | "edit" | "export" | "print";
    summary: string;
    userId?: string | null;
    schoolId?: string | null;
    ipAddress?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  await supabase.from("platform_sensitive_access_log").insert({
    user_id: input.userId ?? null,
    school_id: input.schoolId ?? null,
    record_type: input.recordType,
    entity_type: input.entityType,
    entity_id: input.entityId,
    classification: input.classification ?? null,
    access_action: input.accessAction ?? "view",
    ip_address: input.ipAddress ?? null,
    summary: input.summary,
    metadata: input.metadata ?? {},
  });

  await supabase.from("platform_security_events").insert({
    event_type: "sensitive_access",
    user_id: input.userId ?? null,
    actor_user_id: input.userId ?? null,
    school_id: input.schoolId ?? null,
    ip_address: input.ipAddress ?? null,
    summary: input.summary,
    metadata: { entityType: input.entityType, entityId: input.entityId, ...input.metadata },
  });
}
