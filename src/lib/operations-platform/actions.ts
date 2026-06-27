"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canManageOperations, canOperationsPartners } from "@/lib/operations-platform/access";
import { syncOperationsPlatform } from "@/lib/operations-platform/hub";
import { createDeploymentRollout } from "@/lib/operations-platform/deployments";
import { createPartner } from "@/lib/operations-platform/partners";
import { createBackupRecord } from "@/lib/operations-platform/backups";
import { enrollInCourse } from "@/lib/operations-platform/university";
import { createSubscription } from "@/lib/cloud-platform/subscriptions";

async function resolveOps() {
  const ctx = await getIdentityContext();
  if (!ctx) throw new Error("Unauthorized");
  const supabase = await createAuthClient();
  return { ctx, supabase };
}

function revalidateOps() {
  revalidatePath("/operations");
  revalidatePath("/operations/dashboard");
}

export async function refreshOperationsAction(): Promise<void> {
  const { ctx, supabase } = await resolveOps();
  if (!canManageOperations(ctx)) return;
  await syncOperationsPlatform(supabase);
  revalidateOps();
}

export async function createDeploymentAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveOps();
  if (!canManageOperations(ctx)) return;
  await createDeploymentRollout(supabase, {
    releaseVersion: formData.get("release_version")?.toString() ?? "15.2.0",
    strategy: formData.get("strategy")?.toString() ?? "rolling",
  });
  revalidatePath("/operations/deployments");
}

export async function createPartnerAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveOps();
  if (!canOperationsPartners(ctx) && !canManageOperations(ctx)) return;
  await createPartner(supabase, {
    partnerName: formData.get("partner_name")?.toString() ?? "Partner",
    partnerType: formData.get("partner_type")?.toString() ?? "implementation",
  });
  revalidatePath("/operations/partners");
}

export async function createBackupAction(): Promise<void> {
  const { ctx, supabase } = await resolveOps();
  if (!canManageOperations(ctx)) return;
  await createBackupRecord(supabase);
  revalidatePath("/operations/backups");
}

export async function enrollCourseAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveOps();
  const courseId = formData.get("course_id")?.toString();
  if (courseId) await enrollInCourse(supabase, courseId, ctx.effectiveUserId);
  revalidatePath("/operations/university");
}

export async function createSubscriptionAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveOps();
  if (!canManageOperations(ctx)) return;
  await createSubscription(supabase, {
    customerId: formData.get("customer_id")?.toString() ?? "",
    planKey: formData.get("plan_key")?.toString() ?? "professional",
    billingCycle: formData.get("billing_cycle")?.toString() ?? "monthly",
  });
  revalidatePath("/operations/subscriptions");
}
