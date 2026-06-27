"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canManageCertification, canAdminCertification } from "@/lib/certification/access";
import { runFullCertification, runNightlyHealthScan } from "@/lib/certification/certification-engine";
import { generateDemoEnvironment } from "@/lib/certification/demo-generator";
import { updateProgress } from "@/lib/certification/training-engine";
import { regenerateDocumentation } from "@/lib/certification/documentation";

async function resolveCert() {
  const ctx = await getIdentityContext();
  if (!ctx) throw new Error("Unauthorized");
  const supabase = await createAuthClient();
  return { ctx, supabase };
}

export async function runCertificationAction(): Promise<void> {
  const { ctx, supabase } = await resolveCert();
  if (!canManageCertification(ctx)) return;

  await runFullCertification(supabase, ctx.effectiveUserId);
  revalidatePath("/dashboard/certification");
  revalidatePath("/dashboard/certification/overview");
  revalidatePath("/dashboard/certification/launch");
  revalidatePath("/dashboard/certification/documentation");
}

export async function refreshHealthAction(): Promise<void> {
  const { ctx, supabase } = await resolveCert();
  if (!canAdminCertification(ctx)) return;

  await runNightlyHealthScan(supabase);
  revalidatePath("/dashboard/certification");
  revalidatePath("/dashboard/certification/overview");
  revalidatePath("/dashboard/certification/launch");
  revalidatePath("/dashboard/certification/documentation");
}

export async function generateDemoAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveCert();
  if (!canManageCertification(ctx)) return;

  await generateDemoEnvironment(supabase, {
    demoName: formData.get("demo_name")?.toString() ?? "Demo School",
    createdBy: ctx.effectiveUserId,
  });

  revalidatePath("/dashboard/certification/demo");
}

export async function completeModuleAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveCert();

  await updateProgress(
    supabase,
    ctx.effectiveUserId,
    formData.get("path_key")?.toString() ?? "",
    formData.get("module_key")?.toString() ?? "platform_overview"
  );

  revalidatePath("/dashboard/certification/training");
}

export async function regenerateDocsAction(): Promise<void> {
  const { ctx, supabase } = await resolveCert();
  if (!canManageCertification(ctx)) return;

  await regenerateDocumentation(supabase);
  revalidatePath("/dashboard/certification/documentation");
}
