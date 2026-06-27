import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { assertParentStudentAccess, getParentLinkedStudentIds } from "@/lib/platform/identity/portal-access";
import { getStudentDocumentCenter } from "@/lib/portal/documents";

export default async function PortalDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/portal/documents");

  const { student: studentParam } = await searchParams;
  const supabase = await createAuthClient();
  const studentIds = await getParentLinkedStudentIds(supabase, sessionUser.id);
  const studentId = studentParam && studentIds.includes(studentParam) ? studentParam : studentIds[0];
  if (!studentId) notFound();

  const docs = await getStudentDocumentCenter(supabase, studentId);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Document Center</h1>
      <p className="text-slate-600">Enrollment, IEP/504, medical, financial, scholarship, and state funding documents.</p>

      {Object.entries(docs.grouped).map(([category, items]) =>
        items && items.length > 0 ? (
          <section key={category} className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold capitalize">{category.replace(/_/g, " ")}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {items.map((d) => (
                <li key={d.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>{d.file_name}</span>
                  <span className="text-slate-500">{d.document_type}{d.expires_at ? ` · exp ${d.expires_at}` : ""}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null
      )}

      {docs.receipts.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Receipts</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {docs.receipts.map((p) => (
              <li key={p.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>{(p.invoices as { invoice_number?: string })?.invoice_number ?? "Payment"}</span>
                <span>${Number(p.amount).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
