"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { resolveMissionControlItem } from "@/lib/platform/automation/mission-control";
import { installMarketplaceTemplateToAdmissions } from "@/lib/platform/automation/marketplace";

export async function resolveMissionControlItemAction(itemId: string) {
  const supabase = await createAuthClient();
  await resolveMissionControlItem(supabase, itemId);
  revalidatePath("/dashboard/mission-control");
  return { success: true };
}

export async function installMarketplaceWorkflow(marketplaceKey: string, schoolId: string) {
  const result = await installMarketplaceTemplateToAdmissions(marketplaceKey, schoolId);
  if (result.error) return { error: result.error };
  revalidatePath("/dashboard/admissions/workflows");
  revalidatePath("/dashboard/mission-control");
  return { success: true, workflowId: result.workflowId };
}
