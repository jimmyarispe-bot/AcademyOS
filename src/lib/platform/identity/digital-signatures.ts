import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export interface RecordDigitalSignatureInput {
  schoolId?: string | null;
  module: string;
  documentType: string;
  entityType: string;
  entityId: string;
  signerUserId?: string | null;
  signerName: string;
  signerEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceInfo?: Record<string, unknown>;
  documentVersion?: string;
  documentHash?: string | null;
  signaturePayload?: Record<string, unknown>;
}

/** 21 — Digital signature capture */
export async function recordDigitalSignature(
  supabase: AuthClient,
  input: RecordDigitalSignatureInput
) {
  const { data, error } = await supabase
    .from("platform_digital_signatures")
    .insert({
      school_id: input.schoolId ?? null,
      module: input.module,
      document_type: input.documentType,
      entity_type: input.entityType,
      entity_id: input.entityId,
      signer_user_id: input.signerUserId ?? null,
      signer_name: input.signerName,
      signer_email: input.signerEmail ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      device_info: input.deviceInfo ?? {},
      document_version: input.documentVersion ?? "1",
      document_hash: input.documentHash ?? null,
      signature_payload: input.signaturePayload ?? {},
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { success: true, signatureId: data.id };
}

export async function getSignaturesForEntity(
  supabase: AuthClient,
  entityType: string,
  entityId: string
) {
  const { data } = await supabase
    .from("platform_digital_signatures")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("signed_at", { ascending: false });

  return data ?? [];
}
