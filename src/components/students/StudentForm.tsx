"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createStudent } from "@/lib/students/actions";
import { GRADES } from "@/lib/constants/grades";
import { PROGRAMS } from "@/lib/constants/programs";
import { FundingSourceCheckboxes } from "@/components/ui/FundingSourceCheckboxes";

interface StudentFormProps {
  schools: { id: string; name: string }[];
  families: { id: string; family_name: string }[];
  schoolYears: { id: string; name: string; school_id: string }[];
}

export function StudentForm({ schools, families, schoolYears }: StudentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createStudent(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/dashboard/students/${result.id}`);
    });
  }

  const inputClass = "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm";
  const labelClass = "block text-sm font-medium text-slate-700";

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6">
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="first_name">First Name *</label>
          <input id="first_name" name="first_name" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="last_name">Last Name *</label>
          <input id="last_name" name="last_name" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="school_id">School *</label>
          <select id="school_id" name="school_id" required className={inputClass} defaultValue="">
            <option value="" disabled>Select school</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="family_id">Family</label>
          <select id="family_id" name="family_id" className={inputClass} defaultValue="">
            <option value="">No family</option>
            {families.map((f) => <option key={f.id} value={f.id}>{f.family_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="program">Program</label>
          <select id="program" name="program" className={inputClass} defaultValue="">
            <option value="">Select program</option>
            {PROGRAMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="grade_level">Grade Level</label>
          <select id="grade_level" name="grade_level" className={inputClass} defaultValue="">
            <option value="">Select grade</option>
            {GRADES.map((grade) => (
              <option key={grade.value} value={grade.value}>{grade.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="date_of_birth">Date of Birth</label>
          <input id="date_of_birth" name="date_of_birth" type="date" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="enrollment_status">Enrollment Status</label>
          <select id="enrollment_status" name="enrollment_status" className={inputClass} defaultValue="pending">
            <option value="pending">Pending</option>
            <option value="enrolled">Enrolled</option>
            <option value="waitlisted">Waitlisted</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <FundingSourceCheckboxes />
        </div>
      </div>

      <button type="submit" disabled={isPending} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
        {isPending ? "Creating…" : "Create Student"}
      </button>
    </form>
  );
}
