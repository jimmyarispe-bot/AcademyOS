"use client";

import { useState } from "react";
import { generateSessionsAction } from "@/lib/scheduling/actions";

interface GenerateSessionsButtonProps {
  sectionId: string;
  sectionCode: string;
}

export function GenerateSessionsButton({ sectionId, sectionCode }: GenerateSessionsButtonProps) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    const result = await generateSessionsAction(formData);
    setPending(false);
    if ("error" in result && result.error) {
      setMessage(result.error);
    } else if ("created" in result) {
      setMessage(`Created ${result.created ?? 0} sessions (${result.skipped ?? 0} skipped)`);
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name="section_id" value={sectionId} />
      <div>
        <label className="block text-xs font-medium text-slate-500">From</label>
        <input
          type="date"
          name="date_from"
          defaultValue={today}
          className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500">To</label>
        <input
          type="date"
          name="date_to"
          defaultValue={in30}
          className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
          required
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "Generating…" : `Generate — ${sectionCode}`}
      </button>
      {message && <p className="w-full text-xs text-slate-600">{message}</p>}
    </form>
  );
}
