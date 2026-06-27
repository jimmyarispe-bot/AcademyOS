import Link from "next/link";
import type { EmployeeRecord } from "@/lib/hr/types";

interface EmployeeListProps {
  employees: EmployeeRecord[];
}

export function EmployeeList({ employees }: EmployeeListProps) {
  if (employees.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No employees yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Name</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Title</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Type</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">School</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {employees.map((e) => {
            const profile = e.employee_profiles;
            const name =
              profile?.display_name ??
              (`${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "—");
            return (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/dashboard/hr/employees/${e.id}`} className="text-brand-700 hover:underline">{name}</Link>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{profile?.job_title ?? "—"}</td>
                <td className="px-4 py-3 text-sm capitalize text-slate-600">{e.employee_type}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize">{e.employment_status.replace("_", " ")}</span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{e.schools?.name ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
