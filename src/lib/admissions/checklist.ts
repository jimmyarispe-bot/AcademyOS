import { createAuthClient } from "@/lib/supabase/server-auth";

export interface ChecklistTemplateItem {
  id: string;
  school_id: string;
  item_key: string;
  label: string;
  description: string | null;
  category: string;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface ApplicationChecklistItem {
  id: string;
  application_id: string;
  item_key: string;
  status: string;
  completed_at: string | null;
  notes: string | null;
  template?: ChecklistTemplateItem;
}

export async function getChecklistTemplate(schoolId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("admissions_checklist_template_items")
    .select("*")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("sort_order");

  return (data ?? []) as ChecklistTemplateItem[];
}

export async function getApplicationChecklist(applicationId: string) {
  const supabase = await createAuthClient();

  const { data: app } = await supabase
    .from("admissions_applications")
    .select("lead_id, admissions_leads(school_id)")
    .eq("id", applicationId)
    .single();

  const schoolId = (
    app?.admissions_leads as { school_id?: string } | null
  )?.school_id;

  if (!schoolId) return { items: [], percentComplete: 0 };

  await supabase.rpc("sync_application_checklist", { p_application_id: applicationId });

  const [checklistResult, templateResult] = await Promise.all([
    supabase
      .from("admissions_application_checklist_items")
      .select("*")
      .eq("application_id", applicationId),
    supabase
      .from("admissions_checklist_template_items")
      .select("*")
      .eq("school_id", schoolId)
      .eq("is_active", true),
  ]);

  const templateByKey = new Map(
    ((templateResult.data ?? []) as ChecklistTemplateItem[]).map((t) => [t.item_key, t])
  );

  const items = ((checklistResult.data ?? []) as ApplicationChecklistItem[])
    .map((item) => ({
      ...item,
      template: templateByKey.get(item.item_key),
    }))
    .filter((item) => item.template)
    .sort(
      (a, b) => (a.template?.sort_order ?? 0) - (b.template?.sort_order ?? 0)
    );

  const required = items.filter((i) => i.template?.is_required);
  const completed = required.filter((i) =>
    ["completed", "waived", "not_applicable"].includes(i.status)
  );

  const percentComplete = required.length
    ? Math.round((completed.length / required.length) * 100)
    : 0;

  return { items, percentComplete };
}

export async function autoSyncChecklistFromData(applicationId: string, leadId: string) {
  const supabase = await createAuthClient();

  const [lead, app, docs, tours, funding, packets] = await Promise.all([
    supabase.from("admissions_leads").select("lead_stage").eq("id", leadId).single(),
    supabase.from("admissions_applications").select("application_status, previous_school").eq("id", applicationId).single(),
    supabase.from("application_documents").select("document_type").eq("application_id", applicationId),
    supabase.from("admissions_tours").select("tour_status").eq("lead_id", leadId),
    supabase.from("state_funding_verifications").select("verification_status").eq("application_id", applicationId),
    supabase.from("enrollment_packets").select("packet_status").eq("application_id", applicationId),
  ]);

  const updates: { item_key: string; status: string }[] = [];

  if (lead.data) updates.push({ item_key: "inquiry", status: "completed" });

  const tourDone = (tours.data ?? []).some((t) => t.tour_status === "completed");
  if (tourDone) updates.push({ item_key: "tour", status: "completed" });

  if (["tour_completed", "application_started", "application_submitted", "admissions_review", "accepted", "enrolled"].includes(lead.data?.lead_stage ?? "")) {
    updates.push({ item_key: "interview", status: "completed" });
  }

  if (app.data?.previous_school) updates.push({ item_key: "application", status: "completed" });

  const docTypes = new Set((docs.data ?? []).map((d) => d.document_type));
  if (docTypes.has("birth_certificate")) updates.push({ item_key: "birth_certificate", status: "completed" });
  if (docTypes.has("immunization")) updates.push({ item_key: "immunization", status: "completed" });
  if (docTypes.has("report_card")) updates.push({ item_key: "report_cards", status: "completed" });

  const fundingVerified = (funding.data ?? []).every((f) => f.verification_status === "verified");
  if (fundingVerified && (funding.data ?? []).length > 0) {
    updates.push({ item_key: "state_scholarship_award_letter", status: "completed" });
  }

  const packetComplete = (packets.data ?? []).some((p) => p.packet_status === "completed");
  if (packetComplete) updates.push({ item_key: "enrollment_packet", status: "completed" });

  for (const u of updates) {
    await supabase
      .from("admissions_application_checklist_items")
      .update({ status: u.status, completed_at: new Date().toISOString() })
      .eq("application_id", applicationId)
      .eq("item_key", u.item_key);
  }
}
