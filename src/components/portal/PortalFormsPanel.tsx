"use client";

import { useTransition } from "react";
import { submitPortalFormAction } from "@/lib/portal/actions";

const inputClass = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

interface PortalFormsPanelProps {
  templates: { id: string; title: string; description: string | null; form_type: string; requires_signature: boolean }[];
  submissions: { id: string; submitted_at: string; portal_form_templates?: { title: string } | { title: string }[] | null }[];
  students: { id: string; first_name: string; last_name: string; family_id: string | null }[];
}

export function PortalFormsPanel({ templates, submissions, students }: PortalFormsPanelProps) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4">
        <h2 className="font-semibold">Available forms</h2>
        {templates.map((t) => (
          <form
            key={t.id}
            className="rounded-xl border border-slate-200 bg-white p-4 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const fd = new FormData(e.currentTarget);
                fd.set("template_id", t.id);
                fd.set("answers", JSON.stringify({ notes: fd.get("notes") }));
                await submitPortalFormAction(fd);
              });
            }}
          >
            <h3 className="font-medium">{t.title}</h3>
            {t.description && <p className="text-sm text-slate-600">{t.description}</p>}
            <select name="student_id" className={inputClass}>
              <option value="">Family-wide</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
            </select>
            <input type="hidden" name="family_id" value={students[0]?.family_id ?? ""} />
            <textarea name="notes" placeholder="Your responses" rows={3} className={inputClass} required />
            {t.requires_signature && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" required />
                I agree and electronically sign this form
              </label>
            )}
            <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50">Submit</button>
          </form>
        ))}
      </section>
      <section>
        <h2 className="font-semibold">Submitted</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {submissions.map((s) => {
            const tmpl = Array.isArray(s.portal_form_templates) ? s.portal_form_templates[0] : s.portal_form_templates;
            return (
              <li key={s.id} className="rounded-lg bg-slate-50 px-3 py-2">
                {tmpl?.title ?? "Form"} — {new Date(s.submitted_at).toLocaleDateString()}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
