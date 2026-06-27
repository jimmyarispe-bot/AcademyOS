import type { createAuthClient } from "@/lib/supabase/server-auth";
import { provisionOrganization } from "@/lib/cloud-platform/provisioning";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

async function countTable(supabase: AuthClient, table: string) {
  const { count } = await supabase.from(table).select("id", { count: "exact", head: true });
  return count ?? 0;
}

export async function generateDemoEnvironment(
  supabase: AuthClient,
  input: { demoName: string; createdBy?: string }
) {
  const { data: demo, error } = await supabase
    .from("cert_demo_environments")
    .insert({
      demo_name: input.demoName,
      status: "generating",
      created_by: input.createdBy ?? null,
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const provision = await provisionOrganization(supabase, {
    targetOrgName: input.demoName,
    blueprintKey: "enterprise",
    createdBy: input.createdBy,
  });

  const [students, schools, employees] = await Promise.all([
    countTable(supabase, "students"),
    countTable(supabase, "schools"),
    countTable(supabase, "employees"),
  ]);

  await supabase.from("cert_demo_environments").update({
    status: provision.organizationId ? "ready" : "pending",
    organization_id: provision.organizationId ?? null,
    artifact_summary: {
      schools,
      students,
      families: Math.floor(students * 0.9),
      teachers: Math.floor(employees * 0.6),
      employees,
      schedules: "provisioned",
      attendance: "connected",
      finance: "connected",
      scholarships: "connected",
      payroll: "connected",
      hr: "connected",
      admissions: "connected",
      executive: "connected",
      mission_control: "connected",
      integrations: "catalog_ready",
    },
  }).eq("id", demo.id);

  return { demoId: demo.id, organizationId: provision.organizationId };
}

export async function getDemoEnvironments(supabase: AuthClient) {
  const { data } = await supabase.from("cert_demo_environments").select("*").order("created_at", { ascending: false }).limit(20);
  return data ?? [];
}
