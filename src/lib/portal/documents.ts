import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const DOCUMENT_CATEGORIES: Record<string, string[]> = {
  enrollment: ["enrollment", "application", "birth_certificate", "immunization"],
  special_education: ["iep", "504", "sped"],
  academic: ["report_card", "progress_report", "assessment"],
  medical: ["medical", "medication", "allergy"],
  financial: ["tuition_agreement", "receipt", "contract"],
  scholarship: ["scholarship", "tax_return"],
  state_funding: ["award_letter", "funding_verification", "esa_voucher"],
};

export async function getStudentDocumentCenter(supabase: AuthClient, studentId: string) {
  const [documents, payments] = await Promise.all([
    supabase
      .from("student_documents")
      .select("*")
      .eq("student_id", studentId)
      .neq("status", "deleted")
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("*, invoices!inner(student_id, invoice_number)")
      .eq("invoices.student_id", studentId)
      .order("paid_at", { ascending: false })
      .limit(20),
  ]);

  const grouped: Record<string, NonNullable<typeof documents.data>> = {
    enrollment: [],
    special_education: [],
    academic: [],
    medical: [],
    financial: [],
    scholarship: [],
    state_funding: [],
    other: [],
  };

  for (const doc of documents.data ?? []) {
    const type = doc.document_type.toLowerCase();
    let bucket = "other";
    for (const [cat, keys] of Object.entries(DOCUMENT_CATEGORIES)) {
      if (keys.some((k) => type.includes(k))) {
        bucket = cat;
        break;
      }
    }
    grouped[bucket].push(doc);
  }

  return {
    grouped,
    allDocuments: documents.data ?? [],
    scholarshipDocuments: (documents.data ?? []).filter((d) =>
      d.document_type.toLowerCase().includes("scholarship")
    ),
    receipts: payments.data ?? [],
  };
}
