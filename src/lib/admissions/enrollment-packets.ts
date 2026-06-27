import { createAuthClient } from "@/lib/supabase/server-auth";

export interface EnrollmentPacketView {
  id: string;
  application_id: string;
  lead_id: string;
  packet_status: string;
  generated_at: string;
  completed_at: string | null;
  templates: {
    template_key: string;
    title: string;
    body_html: string;
    requires_signature: boolean;
    signed: boolean;
    signature?: {
      signer_name: string;
      signed_at: string;
    } | null;
  }[];
}

export async function generateEnrollmentPacket(applicationId: string, leadId: string) {
  const supabase = await createAuthClient();

  const { data: lead } = await supabase
    .from("admissions_leads")
    .select("school_id")
    .eq("id", leadId)
    .single();

  if (!lead) return { error: "Lead not found" };

  const { data: existing } = await supabase
    .from("enrollment_packets")
    .select("id")
    .eq("application_id", applicationId)
    .maybeSingle();

  if (existing) return { packetId: existing.id };

  const { data: packet, error } = await supabase
    .from("enrollment_packets")
    .insert({
      application_id: applicationId,
      lead_id: leadId,
      school_id: lead.school_id,
      packet_status: "sent",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase
    .from("admissions_application_checklist_items")
    .update({ status: "pending" })
    .eq("application_id", applicationId)
    .eq("item_key", "enrollment_packet");

  return { packetId: packet.id };
}

export async function getEnrollmentPacket(applicationId: string): Promise<EnrollmentPacketView | null> {
  const supabase = await createAuthClient();

  const { data: packet } = await supabase
    .from("enrollment_packets")
    .select("*")
    .eq("application_id", applicationId)
    .maybeSingle();

  if (!packet) return null;

  const { data: lead } = await supabase
    .from("admissions_leads")
    .select("school_id")
    .eq("id", packet.lead_id)
    .single();

  const [templatesResult, signaturesResult] = await Promise.all([
    supabase
      .from("enrollment_packet_templates")
      .select("*")
      .eq("school_id", lead?.school_id ?? "")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("enrollment_packet_signatures")
      .select("*")
      .eq("enrollment_packet_id", packet.id),
  ]);

  const sigByKey = new Map(
    (signaturesResult.data ?? []).map((s) => [
      s.template_key,
      { signer_name: s.signer_name, signed_at: s.signed_at },
    ])
  );

  const templates = (templatesResult.data ?? []).map((t) => ({
    template_key: t.template_key,
    title: t.title,
    body_html: t.body_html,
    requires_signature: t.requires_signature,
    signed: sigByKey.has(t.template_key),
    signature: sigByKey.get(t.template_key) ?? null,
  }));

  return {
    ...(packet as Omit<EnrollmentPacketView, "templates">),
    templates,
  };
}

export async function signEnrollmentDocument(formData: FormData) {
  const supabase = await createAuthClient();

  const packetId = formData.get("enrollment_packet_id") as string;
  const templateKey = formData.get("template_key") as string;
  const signerName = formData.get("signer_name") as string;
  const signerEmail = formData.get("signer_email") as string;
  const signatureText = formData.get("signature_text") as string;
  const applicationId = formData.get("application_id") as string;

  const { error } = await supabase.from("enrollment_packet_signatures").insert({
    enrollment_packet_id: packetId,
    template_key: templateKey,
    signer_name: signerName,
    signer_email: signerEmail,
    signature_text: signatureText,
  });

  if (error) return { error: error.message };

  const { data: packet } = await supabase
    .from("enrollment_packets")
    .select("id, school_id, lead_id")
    .eq("id", packetId)
    .single();

  const { data: templates } = await supabase
    .from("enrollment_packet_templates")
    .select("template_key, requires_signature")
    .eq("school_id", packet?.school_id ?? "")
    .eq("is_active", true)
    .eq("requires_signature", true);

  const { data: signatures } = await supabase
    .from("enrollment_packet_signatures")
    .select("template_key")
    .eq("enrollment_packet_id", packetId);

  const requiredKeys = new Set((templates ?? []).map((t) => t.template_key));
  const signedKeys = new Set((signatures ?? []).map((s) => s.template_key));

  const allSigned = [...requiredKeys].every((k) => signedKeys.has(k));

  if (allSigned) {
    await supabase
      .from("enrollment_packets")
      .update({
        packet_status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", packetId);

    await supabase
      .from("admissions_application_checklist_items")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("application_id", applicationId)
      .eq("item_key", "enrollment_packet");
  } else {
    await supabase
      .from("enrollment_packets")
      .update({ packet_status: "partially_signed" })
      .eq("id", packetId);
  }

  return { success: true, completed: allSigned };
}
