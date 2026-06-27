import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getTickets(supabase: AuthClient, status?: string) {
  let query = supabase
    .from("cloud_support_tickets")
    .select("*, cloud_customers(customer_name)")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data } = await query.limit(50);
  return data ?? [];
}

export async function createTicket(
  supabase: AuthClient,
  input: {
    customerId: string;
    subject: string;
    description?: string;
    ticketType?: string;
    priority?: string;
    createdBy?: string;
  }
) {
  const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`;
  const { data, error } = await supabase
    .from("cloud_support_tickets")
    .insert({
      customer_id: input.customerId,
      ticket_number: ticketNumber,
      subject: input.subject,
      description: input.description ?? null,
      ticket_type: input.ticketType ?? "support",
      priority: input.priority ?? "normal",
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { ticketId: data.id, ticketNumber };
}

export async function updateTicketStatus(supabase: AuthClient, ticketId: string, status: string) {
  const updates: Record<string, unknown> = { status };
  if (status === "resolved" || status === "closed") updates.resolved_at = new Date().toISOString();
  await supabase.from("cloud_support_tickets").update(updates).eq("id", ticketId);
}

export async function addInternalNote(supabase: AuthClient, ticketId: string, note: string, authorId?: string) {
  const { data: ticket } = await supabase.from("cloud_support_tickets").select("internal_notes").eq("id", ticketId).single();
  const notes = [...((ticket?.internal_notes as unknown[]) ?? []), { note, authorId, at: new Date().toISOString() }];
  await supabase.from("cloud_support_tickets").update({ internal_notes: notes }).eq("id", ticketId);
}
