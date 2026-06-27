import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getIncidents(supabase: AuthClient, openOnly = false) {
  let query = supabase.from("cloud_incidents").select("*").order("started_at", { ascending: false });
  if (openOnly) query = query.neq("status", "resolved");
  const { data } = await query.limit(30);
  return data ?? [];
}

export async function createIncident(
  supabase: AuthClient,
  input: {
    title: string;
    severity?: string;
    affectedCustomers?: string[];
    createdBy?: string;
  }
) {
  const incidentNumber = `INC-${Date.now().toString(36).toUpperCase()}`;
  const { data, error } = await supabase
    .from("cloud_incidents")
    .insert({
      incident_number: incidentNumber,
      title: input.title,
      severity: input.severity ?? "minor",
      affected_customers: input.affectedCustomers ?? [],
      timeline: [{ event: "Incident opened", at: new Date().toISOString() }],
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { incidentId: data.id, incidentNumber };
}

export async function resolveIncident(supabase: AuthClient, incidentId: string, rootCause?: string) {
  const { data: incident } = await supabase.from("cloud_incidents").select("timeline").eq("id", incidentId).single();
  const timeline = [...((incident?.timeline as unknown[]) ?? []), { event: "Resolved", at: new Date().toISOString() }];

  await supabase.from("cloud_incidents").update({
    status: "resolved",
    root_cause: rootCause ?? null,
    resolved_at: new Date().toISOString(),
    timeline,
  }).eq("id", incidentId);
}
