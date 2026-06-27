"use client";

import { useTransition } from "react";
import Link from "next/link";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatCount } from "@/lib/format";
import type { ComplianceDashboardStats, ComplianceDomainScore, ComplianceObligation } from "@/lib/compliance/types";
import {
  completeObligationAction,
  createCategoryAction,
  createObligationAction,
  registerDocumentAction,
  saveEscalationRuleAction,
  saveReminderScheduleAction,
} from "@/lib/compliance/actions";

const inputClass = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

interface ComplianceTabsProps {
  view: string;
  stats: ComplianceDashboardStats;
  obligations: ComplianceObligation[];
  categories: Record<string, unknown>[];
  domainScores: ComplianceDomainScore[];
  documents: Record<string, unknown>[];
  reminderSchedules: Record<string, unknown>[];
  escalationRules: Record<string, unknown>[];
  schools: { id: string; name: string }[];
  calendarItems: Pick<ComplianceObligation, "id" | "title" | "due_date" | "status" | "risk_level">[];
  canAdmin: boolean;
  schoolId: string;
}

export function ComplianceTabs({
  view,
  stats,
  obligations,
  categories,
  domainScores,
  documents,
  reminderSchedules,
  escalationRules,
  schools,
  calendarItems,
  canAdmin,
  schoolId,
}: ComplianceTabsProps) {
  const [pending, startTransition] = useTransition();

  if (view === "dashboard") {
    return (
      <div className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Upcoming (30d)" value={formatCount(stats.upcoming)} accent="sky" icon={<span className="font-bold">U</span>} description="Due soon" />
          <StatCard title="Overdue" value={formatCount(stats.overdue)} accent="rose" icon={<span className="font-bold">!</span>} description="Requires action" />
          <StatCard title="Completed" value={formatCount(stats.completed)} accent="emerald" icon={<span className="font-bold">✓</span>} description="On record" />
          <StatCard title="Compliance %" value={`${stats.compliancePct}%`} accent="indigo" icon={<span className="font-bold">%</span>} description="Completion rate" />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Executive scores by domain</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {domainScores.filter((s) => s.total_obligations > 0).map((s) => (
                <li key={s.domain} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="capitalize">{s.domain.replace(/_/g, " ")}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${scoreColor(s.status_indicator)}`}>{s.score_pct}%</span>
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">By category</h2>
            <ul className="mt-4 space-y-1 text-sm">
              {Object.entries(stats.byCategory).slice(0, 10).map(([cat, count]) => (
                <li key={cat} className="flex justify-between"><span>{cat}</span><span>{count}</span></li>
              ))}
            </ul>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Risk heat map (critical items: {stats.criticalCount})</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {domainScores.map((s) => (
              <div key={s.domain} className={`rounded-xl p-3 text-center text-sm ${heatColor(s.status_indicator)}`}>
                <p className="font-medium capitalize">{s.domain.replace(/_/g, " ")}</p>
                <p className="text-xs">{s.overdue_obligations} overdue</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (view === "upcoming" || view === "overdue" || view === "obligations") {
    const list = view === "overdue"
      ? obligations.filter((o) => o.status === "overdue" || (o.status === "pending" && o.due_date < new Date().toISOString().split("T")[0]))
      : view === "upcoming"
        ? obligations.filter((o) => o.due_date >= new Date().toISOString().split("T")[0])
        : obligations;

    return (
      <div className="space-y-6">
        {view === "obligations" && (
          <ObligationForm schools={schools} categories={categories} pending={pending} startTransition={startTransition} />
        )}
        <ObligationTable obligations={list} pending={pending} startTransition={startTransition} />
      </div>
    );
  }

  if (view === "calendar") {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Compliance calendar</h2>
          <a href={`/api/compliance/calendar.ics?schoolId=${schoolId}`} className="text-sm text-brand-600 hover:underline">Export ICS →</a>
        </div>
        <ul className="space-y-2 text-sm">
          {calendarItems.map((o) => (
            <li key={o.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>{o.title}</span>
              <span className="text-slate-500">{o.due_date} · {o.status}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (view === "categories") {
    return (
      <div className="space-y-6">
        {canAdmin && (
          <form className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 max-w-lg" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { await createCategoryAction(new FormData(e.currentTarget)); e.currentTarget.reset(); }); }}>
            <h2 className="font-semibold">Add category</h2>
            <input name="name" placeholder="Category name" required className={inputClass} />
            <input name="category_key" placeholder="Unique key" required className={inputClass} />
            <select name="domain" className={inputClass}>
              {["governance", "accreditation", "licensing", "insurance", "hr", "finance", "facilities", "technology", "student_services", "general"].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Create</button>
          </form>
        )}
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          {categories.map((c) => (
            <li key={c.id as string} className="rounded-lg border border-slate-100 px-3 py-2">
              <p className="font-medium">{c.name as string}</p>
              <p className="text-xs capitalize text-slate-500">{c.domain as string}</p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (view === "documents") {
    return (
      <div className="space-y-6">
        <form className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 max-w-lg" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { await registerDocumentAction(new FormData(e.currentTarget)); }); }}>
          <h2 className="font-semibold">Register document</h2>
          <select name="obligation_id" required className={inputClass}>
            {obligations.slice(0, 50).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
          <select name="document_type" className={inputClass}>
            {["pdf", "inspection_report", "license", "insurance_certificate", "signed_form", "photo", "spreadsheet"].map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
          <input name="file_name" placeholder="File name" required className={inputClass} />
          <input name="storage_path" placeholder="Storage path" required className={inputClass} />
          <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Upload record</button>
        </form>
        <ul className="space-y-2 text-sm">
          {documents.map((d) => (
            <li key={d.id as string} className="rounded-lg bg-slate-50 px-3 py-2">{d.file_name as string} · v{d.version_number as number}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (view === "automation") {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="font-semibold">Automation integration</h2>
        <p className="text-sm text-slate-600">Compliance obligations sync from HR certifications, executive requirements, IEP reviews, and other modules via the universal deadline engine. Reminders and escalations run through <Link href="/dashboard/mission-control" className="text-brand-600">Mission Control</Link> and the platform queue processor.</p>
        <ul className="text-sm space-y-1 text-slate-600">
          <li>• Module sync runs on each queue processing cycle</li>
          <li>• Reminders: 180→1 days + due today + daily when overdue</li>
          <li>• Escalation: 7→45 days to leadership roles</li>
          <li>• Completion auto-generates next recurrence</li>
        </ul>
      </section>
    );
  }

  if (view === "reports") {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="font-semibold">Compliance reports</h2>
        <div className="flex flex-wrap gap-3">
          <a href={`/api/compliance/reports?type=summary&schoolId=${schoolId}`} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Summary CSV</a>
          <a href={`/api/compliance/reports?type=overdue&schoolId=${schoolId}`} className="rounded-lg bg-slate-100 px-4 py-2 text-sm">Overdue CSV</a>
        </div>
        <p className="text-xs text-slate-500">PDF export architecture ready via Report Studio. CSV available now.</p>
      </section>
    );
  }

  if (view === "administration" && canAdmin) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <form className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { await saveReminderScheduleAction(new FormData(e.currentTarget)); }); }}>
          <h2 className="font-semibold">Reminder schedule</h2>
          <input name="name" placeholder="Schedule name" required className={inputClass} />
          <input name="days_before" placeholder="Days: 180,90,30,7,1,0" className={inputClass} defaultValue="180,120,90,60,45,30,21,14,7,3,1,0" />
          <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Save</button>
          <ul className="text-xs text-slate-500 space-y-1">
            {reminderSchedules.map((s) => <li key={s.id as string}>{s.name as string}</li>)}
          </ul>
        </form>
        <form className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { await saveEscalationRuleAction(new FormData(e.currentTarget)); }); }}>
          <h2 className="font-semibold">Escalation rule</h2>
          <input name="name" placeholder="Rule name" required className={inputClass} />
          <input name="days_overdue" type="number" placeholder="Days overdue" required className={inputClass} />
          <select name="escalate_to_role" className={inputClass}>
            {["SCHOOL_LEADER", "EXECUTIVE_DIRECTOR", "CEO", "FOUNDER", "HR", "FINANCE"].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Save</button>
          <ul className="text-xs text-slate-500 space-y-1">
            {escalationRules.map((r) => <li key={r.id as string}>{r.days_overdue as number}d → {r.escalate_to_role as string}</li>)}
          </ul>
        </form>
      </div>
    );
  }

  return <p className="text-slate-500">Select a tab above.</p>;
}

function ObligationForm({ schools, categories, pending, startTransition }: {
  schools: { id: string; name: string }[];
  categories: Record<string, unknown>[];
  pending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  return (
    <form className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { await createObligationAction(new FormData(e.currentTarget)); e.currentTarget.reset(); }); }}>
      <h2 className="font-semibold">Create obligation</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="school_id" required className={inputClass}>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select name="category_key" required className={inputClass}>
          {categories.map((c) => <option key={c.id as string} value={c.category_key as string}>{c.name as string}</option>)}
        </select>
      </div>
      <input name="title" placeholder="Title" required className={inputClass} />
      <textarea name="description" placeholder="Description" className={inputClass} />
      <div className="grid gap-3 sm:grid-cols-3">
        <input name="due_date" type="date" required className={inputClass} />
        <select name="frequency" className={inputClass}>
          {["one_time", "monthly", "quarterly", "semiannual", "annual"].map((f) => <option key={f} value={f}>{f.replace(/_/g, " ")}</option>)}
        </select>
        <select name="risk_level" className={inputClass}>
          {["low", "medium", "high", "critical"].map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Create obligation</button>
    </form>
  );
}

function ObligationTable({ obligations, pending, startTransition }: {
  obligations: ComplianceObligation[];
  pending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left">Title</th>
            <th className="px-4 py-3 text-left">Category</th>
            <th className="px-4 py-3 text-left">Due</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Risk</th>
            <th className="px-4 py-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {obligations.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-3 font-medium">{o.title}</td>
              <td className="px-4 py-3 text-slate-500">{o.compliance_categories?.name ?? "—"}</td>
              <td className="px-4 py-3">{o.due_date}</td>
              <td className="px-4 py-3 capitalize">{o.status}</td>
              <td className="px-4 py-3 capitalize">{o.risk_level}</td>
              <td className="px-4 py-3">
                {o.status !== "completed" && (
                  <button type="button" disabled={pending} className="text-xs text-brand-600" onClick={() => startTransition(async () => { const fd = new FormData(); fd.set("obligation_id", o.id); await completeObligationAction(fd); })}>Complete</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!obligations.length && <p className="py-8 text-center text-slate-500">No obligations in this view.</p>}
    </div>
  );
}

function scoreColor(status: string) {
  if (status === "green") return "bg-emerald-100 text-emerald-800";
  if (status === "red") return "bg-rose-100 text-rose-800";
  return "bg-amber-100 text-amber-800";
}

function heatColor(status: string) {
  if (status === "green") return "bg-emerald-50 text-emerald-900";
  if (status === "red") return "bg-rose-50 text-rose-900";
  return "bg-amber-50 text-amber-900";
}
