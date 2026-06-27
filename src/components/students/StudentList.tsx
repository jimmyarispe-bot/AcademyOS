import Link from "next/link";
import { gradeLabel } from "@/lib/constants/grades";
import { programLabel } from "@/lib/constants/programs";
import { FundingSourceBadges } from "@/components/ui/FundingSourceBadges";
import type { StudentRecord } from "@/lib/students/queries";

interface StudentListProps {
  students: StudentRecord[];
}

export function StudentList({ students }: StudentListProps) {
  if (students.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No students yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Name</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Grade</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Program</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Funding</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Family</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {students.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50/50">
              <td className="px-4 py-3">
                <Link href={`/dashboard/students/${s.id}`} className="font-medium text-brand-600 hover:text-brand-700">
                  {s.first_name} {s.last_name}
                </Link>
              </td>
              <td className="px-4 py-3 text-sm text-slate-600">{gradeLabel(s.grade_level)}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{programLabel(s.program)}</td>
              <td className="px-4 py-3">
                <FundingSourceBadges codes={s.funding_sources} />
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-700">
                  {s.enrollment_status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-slate-500">{s.families?.family_name ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
