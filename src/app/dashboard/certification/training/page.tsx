import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getUniversityPaths, getUserProgress } from "@/lib/certification/training-engine";
import { CertShell } from "@/components/certification/CertNav";
import { completeModuleAction } from "@/lib/certification/actions";

export default async function CertificationTrainingPage() {
  await requirePagePermission(["certification.view"]);
  const ctx = await getIdentityContext();
  const supabase = await createAuthClient();
  const [paths, progress] = await Promise.all([
    getUniversityPaths(supabase),
    ctx ? getUserProgress(supabase, ctx.effectiveUserId) : [],
  ]);

  return (
    <CertShell title="AcademyOS University" subtitle="Learning paths with lessons, walkthroughs, knowledge checks, certificates, and CE history">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {paths.map((path) => {
          const prog = progress.find((p) => p.path_key === path.path_key);
          const modules = (path.modules as string[]) ?? [];
          return (
            <div key={path.path_key} className="rounded-2xl border bg-white p-4">
              <h3 className="font-semibold">{path.path_title}</h3>
              <p className="text-sm text-slate-500">{path.target_role} · {path.estimated_minutes} min · {modules.length} modules</p>
              <p className="mt-2 text-sm">Progress: {prog?.progress_pct ?? 0}%</p>
              {prog?.certificate_issued_at && <p className="text-xs text-emerald-600">Certificate issued</p>}
              <p className="mt-1 text-xs text-slate-400">Videos: placeholder · Interactive tours available</p>
              <form action={completeModuleAction} className="mt-2">
                <input type="hidden" name="path_key" value={path.path_key} />
                <input type="hidden" name="module_key" value={modules[0] ?? "platform_overview"} />
                <button type="submit" className="text-sm text-emerald-600 hover:underline">Complete next module</button>
              </form>
            </div>
          );
        })}
      </div>
    </CertShell>
  );
}
