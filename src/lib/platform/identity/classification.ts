import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { DataClassification } from "@/lib/platform/identity/types";
import { logSensitiveAccess } from "@/lib/platform/identity/classification-audit";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getRecordClassification(
  supabase: AuthClient,
  entityType: string,
  entityId: string
): Promise<DataClassification> {
  const { data } = await supabase
    .from("platform_record_classifications")
    .select("classification")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();

  return (data?.classification as DataClassification) ?? "internal";
}

export async function setRecordClassification(
  supabase: AuthClient,
  input: {
    schoolId?: string | null;
    module: string;
    entityType: string;
    entityId: string;
    classification: DataClassification;
    actorUserId?: string | null;
  }
) {
  const { error } = await supabase.from("platform_record_classifications").upsert(
    {
      school_id: input.schoolId ?? null,
      module: input.module,
      entity_type: input.entityType,
      entity_id: input.entityId,
      classification: input.classification,
      classified_by: input.actorUserId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "entity_type,entity_id" }
  );

  return error ? { error: error.message } : { success: true };
}

export async function canAccessClassification(
  supabase: AuthClient,
  classification: DataClassification,
  userId?: string
): Promise<boolean> {
  const { data } = await supabase.rpc("can_access_classification", {
    check_classification: classification,
  });
  void userId;
  return Boolean(data);
}

export async function requireClassificationAccess(
  supabase: AuthClient,
  entityType: string,
  entityId: string,
  action: "view" | "edit" | "export" = "view"
): Promise<{ ok: true; classification: DataClassification } | { ok: false; error: string }> {
  const classification = await getRecordClassification(supabase, entityType, entityId);
  const allowed = await canAccessClassification(supabase, classification);

  if (!allowed) {
    return { ok: false, error: "Classification access denied" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (["medical", "special_education", "restricted", "executive"].includes(classification)) {
    await logSensitiveAccess(supabase, {
      recordType: classification,
      entityType,
      entityId,
      classification,
      accessAction: action,
      summary: `Accessed ${classification} record (${action})`,
      userId: user?.id,
    });
  }

  return { ok: true, classification };
}
