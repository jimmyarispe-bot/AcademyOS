"use server";

/**
 * Server actions for documents attached to a person.
 *
 * The bucket is private and carries no storage.objects policies, so every read
 * and write here goes through the service role AFTER a permission check. The
 * check is not decorative: student paperwork answers to students.view/edit and
 * staff paperwork to hr.view/manage, and migration 245 enforces the same split
 * in RLS, so a bypass of this layer still fails at the row.
 */

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getLegacyUserFromAuthClient } from "@/lib/platform/authentication";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { hasPermission } from "@/lib/platform/identity/authorization-service";
import {
  documentStoragePath,
  detectSource,
  MAX_DOCUMENT_BYTES,
  validateDocumentDraft,
  type DocumentSubjectType,
  type PersonDocument,
} from "@/lib/people/documents-shared";

const BUCKET = "person-documents";

/** Signed URLs are short-lived on purpose — these are children's records. */
const SIGNED_URL_TTL_SECONDS = 300;

function permissionsFor(subjectType: DocumentSubjectType): { view: string; edit: string } {
  return subjectType === "employee"
    ? { view: "hr.view", edit: "hr.manage" }
    : { view: "students.view", edit: "students.edit" };
}

async function assertAccess(
  subjectType: DocumentSubjectType,
  level: "view" | "edit"
): Promise<{ ok: true } | { ok: false; error: string }> {
  const identity = await getIdentityContext();
  if (!identity) return { ok: false, error: "Not signed in." };
  const needed = permissionsFor(subjectType)[level];
  if (!hasPermission(identity, needed)) {
    // Name the permission. A bare "not allowed" sends the operator to guess at
    // their roles, which cost an hour on the admissions contacts page.
    return {
      ok: false,
      error: `This needs the ${needed} permission. Your roles: ${
        identity.roles?.length ? identity.roles.join(", ") : "none"
      }.`,
    };
  }
  return { ok: true };
}

type DocumentRow = {
  id: string;
  subject_type: DocumentSubjectType;
  subject_id: string;
  title: string;
  category: string | null;
  notes: string | null;
  source: PersonDocument["source"];
  storage_path: string | null;
  external_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
  users?: { first_name: string | null; last_name: string | null } | null;
};

function toDocument(row: DocumentRow): PersonDocument {
  const name = [row.users?.first_name, row.users?.last_name].filter(Boolean).join(" ").trim();
  return {
    id: row.id,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    title: row.title,
    category: row.category,
    notes: row.notes,
    source: row.source,
    storagePath: row.storage_path,
    externalUrl: row.external_url,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    uploadedByName: name || null,
    createdAt: row.created_at,
  };
}

export async function listPersonDocuments(
  subjectType: DocumentSubjectType,
  subjectId: string
): Promise<{ documents: PersonDocument[] } | { error: string }> {
  const access = await assertAccess(subjectType, "view");
  if (!access.ok) return { error: access.error };

  const supabase = await createAuthClient();
  const { data, error } = await supabase
    .from("person_documents")
    .select(
      "id, subject_type, subject_id, title, category, notes, source, storage_path, external_url, file_name, mime_type, file_size_bytes, created_at, users:uploaded_by(first_name, last_name)"
    )
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return { documents: (data as unknown as DocumentRow[]).map(toDocument) };
}

/**
 * Upload a file and register it, in that order, with the row written last.
 *
 * If the row write fails the uploaded object is removed. A file in the bucket
 * with no row pointing at it is invisible to every screen and every report —
 * it exists only as storage cost and a privacy liability.
 */
export async function uploadPersonDocument(formData: FormData) {
  const subjectType = String(formData.get("subject_type") ?? "") as DocumentSubjectType;
  const subjectId = String(formData.get("subject_id") ?? "");
  const file = formData.get("file");

  const access = await assertAccess(subjectType, "edit");
  if (!access.ok) return { error: access.error };
  if (!(file instanceof File)) return { error: "No file was received." };

  const draft = {
    title: String(formData.get("title") ?? "").trim() || file.name,
    category: String(formData.get("category") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    source: "upload" as const,
    externalUrl: null,
    fileName: file.name,
    fileSizeBytes: file.size,
  };

  const issues = validateDocumentDraft(draft);
  if (issues.length) return { error: issues.map((i) => i.message).join(" ") };
  if (file.size > MAX_DOCUMENT_BYTES) return { error: "That file is over the 50 MB limit." };

  const supabase = await createAuthClient();
  const user = await getLegacyUserFromAuthClient(supabase);
  const admin = createServiceRoleClient();

  const documentId = crypto.randomUUID();
  const path = documentStoragePath(subjectType, subjectId, documentId, file.name);

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  const { error: rowError } = await admin.from("person_documents").insert({
    id: documentId,
    subject_type: subjectType,
    subject_id: subjectId,
    title: draft.title,
    category: draft.category,
    notes: draft.notes,
    source: "upload",
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || null,
    file_size_bytes: file.size,
    uploaded_by: user?.id ?? null,
  });

  if (rowError) {
    await admin.storage.from(BUCKET).remove([path]);
    return { error: `Saved the file but could not record it, so it was removed: ${rowError.message}` };
  }

  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/hr/employees");
  return { documentId };
}

/** Attach a Google Doc or any other https link, with no file transfer. */
export async function attachPersonDocumentLink(formData: FormData) {
  const subjectType = String(formData.get("subject_type") ?? "") as DocumentSubjectType;
  const subjectId = String(formData.get("subject_id") ?? "");
  const url = String(formData.get("external_url") ?? "").trim();

  const access = await assertAccess(subjectType, "edit");
  if (!access.ok) return { error: access.error };

  const source = detectSource(url);
  const draft = {
    title: String(formData.get("title") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    source,
    externalUrl: url,
    fileName: null,
    fileSizeBytes: null,
  };

  const issues = validateDocumentDraft(draft);
  if (issues.length) return { error: issues.map((i) => i.message).join(" ") };

  const supabase = await createAuthClient();
  const user = await getLegacyUserFromAuthClient(supabase);
  const admin = createServiceRoleClient();

  const { data, error } = await admin
    .from("person_documents")
    .insert({
      subject_type: subjectType,
      subject_id: subjectId,
      title: draft.title,
      category: draft.category,
      notes: draft.notes,
      source,
      external_url: url,
      uploaded_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/hr/employees");
  return { documentId: data.id as string };
}

/**
 * A short-lived link to an uploaded file.
 *
 * Minted per request rather than stored, so revoking access is a matter of
 * removing the permission rather than hunting down URLs already handed out.
 */
export async function getPersonDocumentUrl(documentId: string) {
  const admin = createServiceRoleClient();
  const { data: row, error } = await admin
    .from("person_documents")
    .select("subject_type, storage_path, external_url, file_name")
    .eq("id", documentId)
    .single();

  if (error || !row) return { error: "That document could not be found." };

  const access = await assertAccess(row.subject_type as DocumentSubjectType, "view");
  if (!access.ok) return { error: access.error };

  if (row.external_url) return { url: row.external_url as string };
  if (!row.storage_path) return { error: "That document has no file and no link." };

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path as string, SIGNED_URL_TTL_SECONDS, {
      download: (row.file_name as string) || undefined,
    });

  if (signError || !signed) return { error: signError?.message ?? "Could not create a link." };
  return { url: signed.signedUrl };
}

/** Remove the row, then the object. */
export async function deletePersonDocument(documentId: string) {
  const admin = createServiceRoleClient();
  const { data: row } = await admin
    .from("person_documents")
    .select("subject_type, storage_path")
    .eq("id", documentId)
    .single();

  if (!row) return { error: "That document could not be found." };

  const access = await assertAccess(row.subject_type as DocumentSubjectType, "edit");
  if (!access.ok) return { error: access.error };

  const { error, count } = await admin
    .from("person_documents")
    .delete({ count: "exact" })
    .eq("id", documentId);

  if (error) return { error: error.message };
  // Zero rows deleted is a policy refusal wearing a success costume — the same
  // shape as the schools UPDATE that wrote nothing for months.
  if (!count) return { error: "Nothing was deleted. You may not have permission to remove this." };

  if (row.storage_path) {
    await admin.storage.from(BUCKET).remove([row.storage_path as string]);
  }

  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/hr/employees");
  return { success: true };
}
