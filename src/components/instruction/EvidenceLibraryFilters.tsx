"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const ARTIFACT_TYPES = [
  "photo",
  "pdf",
  "audio",
  "video",
  "assessment",
  "observation_note",
  "work_sample",
  "document",
] as const;

const SUBJECTS = ["reading", "writing", "math", "structured_literacy", "speech", "behavior", "other"] as const;

interface EvidenceLibraryFiltersProps {
  basePath: string;
  goals?: { id: string; title: string }[];
}

export function EvidenceLibraryFilters({ basePath, goals = [] }: EvidenceLibraryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const params = new URLSearchParams(searchParams.toString());
    const currentView = searchParams.get("view");
    if (currentView) params.set("view", currentView);
    else params.set("view", "evidence");

    for (const key of ["q", "artifact_type", "subject_domain", "goal_id", "date_from", "date_to"]) {
      const val = fd.get(key)?.toString().trim();
      if (val) params.set(key, val);
      else params.delete(key);
    }

    startTransition(() => router.push(`${basePath}?${params.toString()}`));
  };

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
    >
      <label className="text-sm">
        <span className="text-slate-500">Search</span>
        <input
          name="q"
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="Title, objective…"
          className="mt-1 block w-40 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="text-sm">
        <span className="text-slate-500">Type</span>
        <select name="artifact_type" defaultValue={searchParams.get("artifact_type") ?? ""} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
          <option value="">All types</option>
          {ARTIFACT_TYPES.map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="text-slate-500">Subject</span>
        <select name="subject_domain" defaultValue={searchParams.get("subject_domain") ?? ""} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
          <option value="">All subjects</option>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
      </label>
      {goals.length > 0 && (
        <label className="text-sm">
          <span className="text-slate-500">Goal</span>
          <select name="goal_id" defaultValue={searchParams.get("goal_id") ?? ""} className="mt-1 block max-w-[160px] rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
            <option value="">All goals</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
        </label>
      )}
      <label className="text-sm">
        <span className="text-slate-500">From</span>
        <input name="date_from" type="date" defaultValue={searchParams.get("date_from") ?? ""} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
      </label>
      <label className="text-sm">
        <span className="text-slate-500">To</span>
        <input name="date_to" type="date" defaultValue={searchParams.get("date_to") ?? ""} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
      </label>
      <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
        {pending ? "Filtering…" : "Filter"}
      </button>
    </form>
  );
}
