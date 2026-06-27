import { formatCurrency } from "@/lib/format";

interface WorkforceAnalyticsPanelProps {
  analytics: {
    staffingLevels: number;
    vacancies: number;
    turnoverRate: number;
    expiringCertifications: number;
    payrollCostsYtd: number;
    substituteUsage30d: number;
    byDepartment: Record<string, number>;
    byEmployeeType: Record<string, number>;
  };
  orgChart: {
    nodes: { id: string; name: string; title: string; department: string | null; supervisorId: string | null }[];
    openPositions: { id: string; title: string; department: string | null }[];
  };
}

export function WorkforceAnalyticsPanel({ analytics, orgChart }: WorkforceAnalyticsPanelProps) {
  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Active staff</p><p className="text-2xl font-semibold">{analytics.staffingLevels}</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Open vacancies</p><p className="text-2xl font-semibold">{analytics.vacancies}</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Turnover rate</p><p className="text-2xl font-semibold">{analytics.turnoverRate}%</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Certs expiring (90d)</p><p className="text-2xl font-semibold">{analytics.expiringCertifications}</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Payroll YTD</p><p className="text-2xl font-semibold">{formatCurrency(analytics.payrollCostsYtd)}</p></article>
        <article className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Substitute usage (30d)</p><p className="text-2xl font-semibold">{analytics.substituteUsage30d}</p></article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">By department</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {Object.entries(analytics.byDepartment).map(([dept, count]) => (
              <li key={dept} className="flex justify-between"><span>{dept}</span><span>{count}</span></li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">By employee type</h2>
          <ul className="mt-3 space-y-1 text-sm capitalize">
            {Object.entries(analytics.byEmployeeType).map(([type, count]) => (
              <li key={type} className="flex justify-between"><span>{type}</span><span>{count}</span></li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Organizational chart</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {orgChart.nodes.filter((n) => !n.supervisorId).map((root) => (
            <OrgNode key={root.id} node={root} all={orgChart.nodes} depth={0} />
          ))}
        </ul>
        {orgChart.openPositions.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <p className="text-sm font-medium text-amber-700">Open positions</p>
            <ul className="mt-2 text-sm text-slate-600">
              {orgChart.openPositions.map((p) => <li key={p.id}>{p.title}{p.department ? ` · ${p.department}` : ""}</li>)}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function OrgNode({ node, all, depth }: { node: { id: string; name: string; title: string }; all: { id: string; name: string; title: string; supervisorId: string | null }[]; depth: number }) {
  const reports = all.filter((n) => n.supervisorId === node.id);
  return (
    <li style={{ marginLeft: depth * 16 }}>
      <span className="font-medium">{node.name}</span> — <span className="text-slate-500">{node.title}</span>
      {reports.length > 0 && (
        <ul className="mt-1">{reports.map((r) => <OrgNode key={r.id} node={r} all={all} depth={depth + 1} />)}</ul>
      )}
    </li>
  );
}
