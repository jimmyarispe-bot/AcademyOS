"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canAdminCloud, canCloudSales, canCloudSupport, canCloudFinance, canCloudOperations, canCloudEngineering } from "@/lib/cloud-platform/access";
import { createCustomer } from "@/lib/cloud-platform/customers";
import { provisionOrganization } from "@/lib/cloud-platform/provisioning";
import { createSubscription } from "@/lib/cloud-platform/subscriptions";
import { issueLicense } from "@/lib/cloud-platform/licensing";
import { createTicket, updateTicketStatus } from "@/lib/cloud-platform/support";
import { startOnboarding } from "@/lib/cloud-platform/customer-success";
import { createIncident, resolveIncident } from "@/lib/cloud-platform/incidents";
import { createRelease, upsertFeatureFlag, createDeployment } from "@/lib/cloud-platform/releases";
import { createInvoice, createContract, saveWhiteLabelSettings } from "@/lib/cloud-platform/billing";
import { installModule } from "@/lib/cloud-platform/marketplace";
import { syncCloudPlatform } from "@/lib/cloud-platform/hub";

async function resolveCloud() {
  const ctx = await getIdentityContext();
  if (!ctx) throw new Error("Unauthorized");
  const supabase = await createAuthClient();
  return { ctx, supabase };
}

export async function createCustomerAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveCloud();
  if (!canCloudSales(ctx) && !canAdminCloud(ctx)) return;

  await createCustomer(supabase, {
    customerName: formData.get("customer_name")?.toString() ?? "",
    customerSlug: formData.get("customer_slug")?.toString() ?? `customer-${Date.now()}`,
    planKey: formData.get("plan_key")?.toString() ?? "free_trial",
    actorUserId: ctx.effectiveUserId,
  });

  revalidatePath("/cloud/customers");
}

export async function provisionOrgAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveCloud();
  if (!canCloudOperations(ctx) && !canAdminCloud(ctx)) return;

  await provisionOrganization(supabase, {
    targetOrgName: formData.get("org_name")?.toString() ?? "",
    blueprintKey: formData.get("blueprint_key")?.toString() ?? "standard",
    customerId: formData.get("customer_id")?.toString(),
    createdBy: ctx.effectiveUserId,
  });

  revalidatePath("/cloud/organizations");
  revalidatePath("/cloud/customers");
}

export async function createSubscriptionAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveCloud();
  if (!canCloudSales(ctx) && !canAdminCloud(ctx)) return;

  await createSubscription(supabase, {
    customerId: formData.get("customer_id")?.toString() ?? "",
    planKey: formData.get("plan_key")?.toString() ?? "starter",
  });

  revalidatePath("/cloud/subscriptions");
}

export async function issueLicenseAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveCloud();
  if (!canCloudSales(ctx) && !canAdminCloud(ctx)) return;

  await issueLicense(supabase, {
    customerId: formData.get("customer_id")?.toString() ?? "",
    licensedModules: JSON.parse(formData.get("modules")?.toString() ?? "[]"),
  });

  revalidatePath("/cloud/licenses");
}

export async function createTicketAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveCloud();
  if (!canCloudSupport(ctx) && !canAdminCloud(ctx)) return;

  await createTicket(supabase, {
    customerId: formData.get("customer_id")?.toString() ?? "",
    subject: formData.get("subject")?.toString() ?? "",
    description: formData.get("description")?.toString(),
    ticketType: formData.get("ticket_type")?.toString(),
    createdBy: ctx.effectiveUserId,
  });

  revalidatePath("/cloud/support");
}

export async function resolveTicketAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveCloud();
  if (!canCloudSupport(ctx) && !canAdminCloud(ctx)) return;

  await updateTicketStatus(supabase, formData.get("ticket_id")?.toString() ?? "", "resolved");
  revalidatePath("/cloud/support");
}

export async function startOnboardingAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveCloud();
  if (!canCloudSupport(ctx) && !canAdminCloud(ctx)) return;

  await startOnboarding(supabase, formData.get("customer_id")?.toString() ?? "", ctx.effectiveUserId);
  revalidatePath("/cloud/onboarding");
}

export async function createIncidentAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveCloud();
  if (!canCloudOperations(ctx) && !canAdminCloud(ctx)) return;

  await createIncident(supabase, {
    title: formData.get("title")?.toString() ?? "",
    severity: formData.get("severity")?.toString(),
  });

  revalidatePath("/cloud/incidents");
}

export async function resolveIncidentAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveCloud();
  if (!canCloudOperations(ctx) && !canAdminCloud(ctx)) return;

  await resolveIncident(supabase, formData.get("incident_id")?.toString() ?? "");
  revalidatePath("/cloud/incidents");
}

export async function createReleaseAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveCloud();
  if (!canCloudEngineering(ctx) && !canAdminCloud(ctx)) return;

  await createRelease(supabase, {
    releaseVersion: formData.get("release_version")?.toString() ?? "",
    releaseType: formData.get("release_type")?.toString(),
    releaseNotes: formData.get("release_notes")?.toString(),
  });

  revalidatePath("/cloud/releases");
}

export async function toggleFeatureFlagAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveCloud();
  if (!canCloudEngineering(ctx) && !canAdminCloud(ctx)) return;

  await upsertFeatureFlag(supabase, {
    flagKey: formData.get("flag_key")?.toString() ?? "",
    displayName: formData.get("display_name")?.toString() ?? "",
    isEnabled: formData.get("is_enabled") === "true",
    isBeta: formData.get("is_beta") === "true",
  });

  revalidatePath("/cloud/feature-flags");
}

export async function createDeploymentAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveCloud();
  if (!canCloudOperations(ctx) && !canAdminCloud(ctx)) return;

  await createDeployment(supabase, {
    environment: formData.get("environment")?.toString() ?? "staging",
    releaseId: formData.get("release_id")?.toString(),
    deployedBy: ctx.effectiveUserId,
  });

  revalidatePath("/cloud/deployments");
}

export async function createInvoiceAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveCloud();
  if (!canCloudFinance(ctx) && !canAdminCloud(ctx)) return;

  await createInvoice(supabase, {
    customerId: formData.get("customer_id")?.toString() ?? "",
    amountUsd: Number(formData.get("amount") ?? 0),
  });

  revalidatePath("/cloud/invoices");
  revalidatePath("/cloud/billing");
}

export async function createContractAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveCloud();
  if (!canCloudSales(ctx) && !canAdminCloud(ctx)) return;

  await createContract(supabase, {
    customerId: formData.get("customer_id")?.toString() ?? "",
    startDate: formData.get("start_date")?.toString() ?? new Date().toISOString().split("T")[0],
    totalValueUsd: Number(formData.get("total_value") ?? 0),
  });

  revalidatePath("/cloud/contracts");
}

export async function installModuleAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveCloud();
  if (!canCloudSales(ctx) && !canAdminCloud(ctx)) return;

  await installModule(supabase, {
    customerId: formData.get("customer_id")?.toString() ?? "",
    moduleKey: formData.get("module_key")?.toString() ?? "",
  });

  revalidatePath("/cloud/marketplace");
}

export async function refreshCloudAction(): Promise<void> {
  const { ctx, supabase } = await resolveCloud();
  if (!canAdminCloud(ctx) && !canCloudOperations(ctx)) return;

  await syncCloudPlatform(supabase);
  revalidatePath("/cloud");
}

export async function saveWhiteLabelAction(formData: FormData): Promise<void> {
  const { ctx, supabase } = await resolveCloud();
  if (!canCloudSales(ctx) && !canAdminCloud(ctx)) return;

  await saveWhiteLabelSettings(supabase, formData.get("customer_id")?.toString() ?? "", {
    primaryColor: formData.get("primary_color")?.toString(),
    customDomain: formData.get("custom_domain")?.toString(),
  });

  revalidatePath("/cloud/settings");
}
