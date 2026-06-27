"use client";

interface OrganizationHierarchyPanelProps {
  hierarchy: {
    organization: { name: string; slug: string } | null;
    regions: Array<{ id: string; name: string; code: string | null }>;
    schools: Array<{ id: string; name: string; organization_id: string | null }>;
    campuses: Array<{ id: string; school_id: string; name: string; is_primary: boolean }>;
    programs: Array<{ id: string; school_id: string; name: string; code: string }>;
    departments: Array<{ id: string; school_id: string; name: string; code: string }>;
  };
}

export function OrganizationHierarchyPanel({ hierarchy }: OrganizationHierarchyPanelProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Root Organization</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">
          {hierarchy.organization?.name ?? "The Academy Way"}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Region → School → Campus → Program → Department
        </p>
      </div>

      {hierarchy.regions.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Regions</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {hierarchy.regions.map((r) => (
              <li key={r.id} className="text-slate-600">
                {r.name} {r.code ? `(${r.code})` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-900">Schools</h3>
        <div className="mt-4 space-y-4">
          {hierarchy.schools.map((school) => (
            <div key={school.id} className="rounded-xl border border-slate-100 p-4">
              <p className="font-medium text-slate-900">{school.name}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs text-slate-600">
                <div>
                  <p className="font-semibold uppercase text-slate-400">Campuses</p>
                  <ul className="mt-1 space-y-1">
                    {hierarchy.campuses
                      .filter((c) => c.school_id === school.id)
                      .map((c) => (
                        <li key={c.id}>
                          {c.name}
                          {c.is_primary ? " (primary)" : ""}
                        </li>
                      ))}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold uppercase text-slate-400">Programs</p>
                  <ul className="mt-1 space-y-1">
                    {hierarchy.programs
                      .filter((p) => p.school_id === school.id)
                      .map((p) => (
                        <li key={p.id}>{p.name}</li>
                      ))}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold uppercase text-slate-400">Departments</p>
                  <ul className="mt-1 space-y-1">
                    {hierarchy.departments
                      .filter((d) => d.school_id === school.id)
                      .map((d) => (
                        <li key={d.id}>{d.name}</li>
                      ))}
                    {hierarchy.departments.filter((d) => d.school_id === school.id).length === 0 && (
                      <li className="text-slate-400">None configured</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
