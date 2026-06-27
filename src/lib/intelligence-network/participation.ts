import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { AnonymizationLevel, ParticipationStatus } from "@/lib/intelligence-network/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getParticipationSettings(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("ain_participation_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data;
}

export async function upsertParticipationSettings(
  supabase: AuthClient,
  input: {
    organizationId: string;
    participationStatus: ParticipationStatus;
    anonymizationLevel?: AnonymizationLevel;
    shareRegional?: boolean;
    shareNational?: boolean;
    shareInternational?: boolean;
    dataCategories?: string[];
    actorUserId?: string;
  }
) {
  await supabase.from("ain_participation_settings").upsert({
    organization_id: input.organizationId,
    participation_status: input.participationStatus,
    anonymization_level: input.anonymizationLevel ?? "standard",
    share_regional: input.shareRegional ?? true,
    share_national: input.shareNational ?? true,
    share_international: input.shareInternational ?? false,
    data_categories: input.dataCategories ?? ["academic", "financial", "staffing", "enrollment", "compliance", "operations"],
    consent_at: input.participationStatus === "opt_in" ? new Date().toISOString() : null,
    consent_by: input.actorUserId ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id" });

  await supabase.from("ain_audit_log").insert({
    organization_id: input.organizationId,
    action_type: "participation_updated",
    actor_user_id: input.actorUserId ?? null,
    details: { status: input.participationStatus },
  });
}
