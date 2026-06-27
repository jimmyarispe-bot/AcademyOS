import type { ConfigModuleRow } from "@/lib/configuration/types";
import { toggleModuleAction } from "@/lib/configuration/actions";

export function ModuleMarketplacePanel({
  organizationId,
  modules,
}: {
  organizationId: string;
  modules: ConfigModuleRow[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {modules.map((mod) => (
        <article key={mod.moduleKey} className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase text-slate-500">{mod.category}</p>
              <h3 className="font-semibold">{mod.displayName}</h3>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs capitalize ${
                mod.status === "enabled" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
              }`}
            >
              {mod.status}
            </span>
          </div>
          {mod.description && <p className="mt-2 text-sm text-slate-500">{mod.description}</p>}
          {mod.dependencies.length > 0 && (
            <p className="mt-2 text-xs text-slate-400">Requires: {mod.dependencies.join(", ")}</p>
          )}
          <form action={toggleModuleAction} className="mt-4">
            <input type="hidden" name="organization_id" value={organizationId} />
            <input type="hidden" name="module_key" value={mod.moduleKey} />
            <input type="hidden" name="action" value={mod.status === "enabled" ? "disable" : "enable"} />
            <button
              type="submit"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                mod.status === "enabled"
                  ? "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  : "bg-brand-600 text-white hover:bg-brand-700"
              }`}
            >
              {mod.status === "enabled" ? "Disable" : "Enable"}
            </button>
          </form>
        </article>
      ))}
    </div>
  );
}
