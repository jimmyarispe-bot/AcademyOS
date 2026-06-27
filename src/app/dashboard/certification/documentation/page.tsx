import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getDocumentation } from "@/lib/certification/documentation";
import { CertShell } from "@/components/certification/CertNav";
import { regenerateDocsAction } from "@/lib/certification/actions";

export default async function CertificationDocumentationPage() {
  await requirePagePermission(["certification.view", "certification.manage", "certification.admin"]);
  const supabase = await createAuthClient();
  const docs = await getDocumentation(supabase);

  return (
    <CertShell title="Documentation Center" subtitle="Administrator, teacher, parent, finance, cloud, developer guides and release notes">
      <form action={regenerateDocsAction}>
        <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white">Regenerate documentation</button>
      </form>
      <ul className="space-y-2">
        {docs.map((d) => (
          <li key={d.id} className="rounded-xl border bg-white px-4 py-3 text-sm">
            <span className="font-medium">{d.doc_title}</span>
            <span className="ml-2 text-slate-500">({d.doc_category}) v{d.version}</span>
          </li>
        ))}
      </ul>
    </CertShell>
  );
}
