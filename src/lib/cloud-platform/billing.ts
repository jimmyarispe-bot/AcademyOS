import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getInvoices(supabase: AuthClient, customerId?: string) {
  let query = supabase
    .from("cloud_invoices")
    .select("*, cloud_customers(customer_name)")
    .order("created_at", { ascending: false });
  if (customerId) query = query.eq("customer_id", customerId);
  const { data } = await query.limit(50);
  return data ?? [];
}

export async function createInvoice(
  supabase: AuthClient,
  input: {
    customerId: string;
    subscriptionId?: string;
    amountUsd: number;
    lineItems?: unknown[];
    dueDate?: string;
  }
) {
  const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
  const { data, error } = await supabase
    .from("cloud_invoices")
    .insert({
      customer_id: input.customerId,
      subscription_id: input.subscriptionId ?? null,
      invoice_number: invoiceNumber,
      amount_usd: input.amountUsd,
      line_items: input.lineItems ?? [],
      due_date: input.dueDate ?? new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      status: "sent",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { invoiceId: data.id, invoiceNumber };
}

export async function getContracts(supabase: AuthClient) {
  const { data } = await supabase
    .from("cloud_contracts")
    .select("*, cloud_customers(customer_name)")
    .order("start_date", { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function createContract(
  supabase: AuthClient,
  input: {
    customerId: string;
    contractType?: string;
    startDate: string;
    endDate?: string;
    totalValueUsd?: number;
  }
) {
  const contractNumber = `CTR-${Date.now().toString(36).toUpperCase()}`;
  const { data, error } = await supabase
    .from("cloud_contracts")
    .insert({
      customer_id: input.customerId,
      contract_number: contractNumber,
      contract_type: input.contractType ?? "subscription",
      start_date: input.startDate,
      end_date: input.endDate ?? null,
      total_value_usd: input.totalValueUsd ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { contractId: data.id, contractNumber };
}

export async function getWhiteLabelSettings(supabase: AuthClient, customerId: string) {
  const { data } = await supabase.from("cloud_white_label_settings").select("*").eq("customer_id", customerId).maybeSingle();
  return data;
}

export async function saveWhiteLabelSettings(
  supabase: AuthClient,
  customerId: string,
  input: { primaryColor?: string; customDomain?: string; customLogoUrl?: string }
) {
  await supabase.from("cloud_white_label_settings").upsert({
    customer_id: customerId,
    primary_color: input.primaryColor ?? null,
    custom_domain: input.customDomain ?? null,
    custom_logo_url: input.customLogoUrl ?? null,
  }, { onConflict: "customer_id" });
}
