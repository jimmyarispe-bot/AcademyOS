"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canManageIntelligenceNetwork } from "@/lib/intelligence-network/access";
import { getPrimaryOrganizationId } from "@/lib/intelligence-network/context";
import { upsertParticipationSettings } from "@/lib/intelligence-network/participation";
import { syncIntelligenceNetwork } from "@/lib/intelligence-network/hub";
import { dismissRecommendation } from "@/lib/intelligence-network/recommendation-engine";
import type { AnonymizationLevel, ParticipationStatus } from "@/lib/intelligence-network/types";

async function resolveNetwork() {
  const ctx = await getIdentityContext();
  if (!ctx) throw new Error("Unauthorized");
  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  if (!orgId) throw new Error("No organization");
  return { ctx, supabase, orgId };
}

function revalidateNetwork() {
  revalidatePath("/dashboard/network");
  revalidatePath("/dashboard/network/benchmarks");
  revalidatePath("/dashboard/network/settings");
}

export async function refreshNetworkAction(): Promise<void> {
  const { ctx, supabase } = await resolveNetwork();
  if (!canManageIntelligenceNetwork(ctx)) return;
  await syncIntelligenceNetwork(supabase);
  revalidateNetwork();
}

export async function updateParticipationAction(formData: FormData): Promise<void> {
  const { ctx, supabase, orgId } = await resolveNetwork();
  if (!canManageIntelligenceNetwork(ctx)) return;

  const categories = formData.getAll("data_categories").map(String);
  await upsertParticipationSettings(supabase, {
    organizationId: orgId,
    participationStatus: (formData.get("participation_status")?.toString() ?? "opt_out") as ParticipationStatus,
    anonymizationLevel: (formData.get("anonymization_level")?.toString() ?? "standard") as AnonymizationLevel,
    shareRegional: formData.get("share_regional") === "on",
    shareNational: formData.get("share_national") === "on",
    shareInternational: formData.get("share_international") === "on",
    dataCategories: categories.length ? categories : undefined,
    actorUserId: ctx.effectiveUserId,
  });
  revalidatePath("/dashboard/network/settings");
}

export async function dismissRecommendationAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveNetwork();
  if (!canManageIntelligenceNetwork(ctx)) return;
  const id = formData.get("recommendation_id")?.toString();
  if (id) await dismissRecommendation(supabase, id);
  revalidatePath("/dashboard/network/recommendations");
}
