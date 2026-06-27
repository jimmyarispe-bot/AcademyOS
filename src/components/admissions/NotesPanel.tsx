"use client";

import { useState, useTransition } from "react";
import { addLeadNote } from "@/lib/admissions/actions";
import type { AdmissionNote } from "@/lib/admissions/queries";

interface NotesPanelProps {
  leadId: string;
  notes: AdmissionNote[];
}

export function NotesPanel({ leadId, notes }: NotesPanelProps) {
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    startTransition(async () => {
      await addLeadNote(leadId, text.trim());
      setText("");
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900">Notes</h3>
      <form onSubmit={handleSubmit} className="mt-3 space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Add a note…"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        <button
          type="submit"
          disabled={isPending || !text.trim()}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Add Note
        </button>
      </form>
      <ul className="mt-4 space-y-3">
        {notes.map((note) => (
          <li key={note.id} className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-sm text-slate-700">{note.note_text}</p>
            <p className="mt-1 text-xs text-slate-400">
              {note.users?.full_name ?? "Staff"} · {new Date(note.created_at).toLocaleString()}
            </p>
          </li>
        ))}
        {notes.length === 0 && (
          <p className="text-sm text-slate-400">No notes yet.</p>
        )}
      </ul>
    </div>
  );
}
