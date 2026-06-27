import type { createAuthClient } from "@/lib/supabase/server-auth";
import { logSecurityEvent } from "@/lib/platform/identity/security";
import { userHasPermission } from "@/lib/platform/identity/permissions";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function isRecordLocked(
  supabase: AuthClient,
  entityType: string,
  entityId: string
): Promise<boolean> {
  const { data } = await supabase.rpc("is_record_locked", {
    check_entity_type: entityType,
    check_entity_id: entityId,
  });
  return Boolean(data);
}

export async function lockRecord(
  supabase: AuthClient,
  input: {
    schoolId?: string | null;
    module: string;
    entityType: string;
    entityId: string;
    lockReason: string;
    lockedBy?: string | null;
  }
) {
  const { error } = await supabase.from("platform_record_locks").upsert(
    {
      school_id: input.schoolId ?? null,
      module: input.module,
      entity_type: input.entityType,
      entity_id: input.entityId,
      lock_reason: input.lockReason,
      locked_by: input.lockedBy ?? null,
      locked_at: new Date().toISOString(),
      is_active: true,
    },
    { onConflict: "entity_type,entity_id" }
  );

  return error ? { error: error.message } : { success: true };
}

export async function unlockRecord(
  supabase: AuthClient,
  input: {
    entityType: string;
    entityId: string;
    unlockReason: string;
    unlockedBy: string;
    ipAddress?: string | null;
  }
) {
  const canUnlock = await userHasPermission(supabase, "records.unlock");
  const isFounder = await userHasPermission(supabase, "founder.override");

  if (!canUnlock && !isFounder) {
    return { error: "Forbidden — records.unlock permission required" };
  }

  const { data: lock } = await supabase
    .from("platform_record_locks")
    .select("id")
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .eq("is_active", true)
    .maybeSingle();

  if (!lock) return { error: "No active lock found" };

  await supabase
    .from("platform_record_locks")
    .update({ is_active: false })
    .eq("id", lock.id);

  await supabase.from("platform_record_unlock_events").insert({
    lock_id: lock.id,
    unlocked_by: input.unlockedBy,
    unlock_reason: input.unlockReason,
    ip_address: input.ipAddress ?? null,
  });

  await logSecurityEvent(supabase, {
    eventType: "record_unlock",
    actorUserId: input.unlockedBy,
    summary: `Record unlocked: ${input.entityType}`,
    metadata: { entityId: input.entityId, reason: input.unlockReason },
  });

  return { success: true };
}

export async function requireUnlockedRecord(
  supabase: AuthClient,
  entityType: string,
  entityId: string
): Promise<{ ok: true } | { ok: false; error: string; locked: true }> {
  const locked = await isRecordLocked(supabase, entityType, entityId);
  if (locked) {
    return { ok: false, error: "Record is locked", locked: true };
  }
  return { ok: true };
}
