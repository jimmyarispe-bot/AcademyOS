import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getCustomers(supabase: AuthClient, limit = 50) {
  const { data } = await supabase
    .from("cloud_customers")
    .select("*, cloud_subscriptions(plan_key, status, monthly_amount_usd)")
    .order("customer_name")
    .limit(limit);
  return data ?? [];
}

export async function getCustomer(supabase: AuthClient, customerId: string) {
  const { data } = await supabase
    .from("cloud_customers")
    .select("*, cloud_subscriptions(*), cloud_licenses(*), cloud_contracts(*)")
    .eq("id", customerId)
    .maybeSingle();
  return data;
}

export async function createCustomer(
  supabase: AuthClient,
  input: {
    customerName: string;
    customerSlug: string;
    organizationId?: string;
    supportTier?: string;
    planKey?: string;
    actorUserId?: string;
  }
) {
  const { data, error } = await supabase
    .from("cloud_customers")
    .insert({
      customer_name: input.customerName,
      customer_slug: input.customerSlug,
      organization_id: input.organizationId ?? null,
      support_tier: input.supportTier ?? "standard",
      status: "onboarding",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (input.planKey) {
    await supabase.from("cloud_subscriptions").insert({
      customer_id: data.id,
      plan_key: input.planKey,
      status: input.planKey === "free_trial" ? "trial" : "active",
      billing_cycle: "monthly",
    });
  }

  await logCloudAudit(supabase, {
    actorUserId: input.actorUserId,
    actionType: "customer_created",
    entityType: "cloud_customers",
    entityId: data.id,
    customerId: data.id,
    details: { customerName: input.customerName },
  });

  return { customerId: data.id };
}

export async function updateCustomerMetrics(supabase: AuthClient, customerId: string) {
  const { data: org } = await supabase
    .from("cloud_customers")
    .select("organization_id")
    .eq("id", customerId)
    .single();

  if (!org?.organization_id) return;

  const { count: students } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("lifecycle_stage", "enrolled");

  const { count: employees } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true });

  await supabase.from("cloud_customers").update({
    student_count: students ?? 0,
    employee_count: employees ?? 0,
  }).eq("id", customerId);
}

async function logCloudAudit(
  supabase: AuthClient,
  input: {
    actorUserId?: string;
    actionType: string;
    entityType: string;
    entityId?: string;
    customerId?: string;
    details?: Record<string, unknown>;
  }
) {
  await supabase.from("cloud_audit_logs").insert({
    actor_user_id: input.actorUserId ?? null,
    action_type: input.actionType,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    customer_id: input.customerId ?? null,
    details: input.details ?? {},
  });
}

export { logCloudAudit };
