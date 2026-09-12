"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createPlatformNoteAction,
  pinPlatformNoteAction,
} from "@/lib/platform/services/server-actions";
import { ActionButton, useActionFeedback } from "@/components/experience-system/feedback";
import { ProfileCard } from "@/components/platform/profile-workspace/ProfilePrimitives";
import type { NoteCategory, PlatformNote } from "@/lib/platform/notes/types";

/**
 * Writing a note about a person, wherever their profile lives.
 *
 * `ProfileNotesPanel` next door shows notes and cannot add one. That was fine
 * while notes arrived from automations; it is not fine for a student record,
 * where the person who knows the thing worth writing down is a member of staff
 * looking at the screen.
 *
 * Entity-agnostic on purpose. The platform notes table is keyed on
 * (entity_type, entity_id), so the same panel serves a student, an employee or
 * a family without a second implementation — which is what the admissions case
 * ended up with, and why a note written there does not follow the child into
 * their student record.
 */

const CATEGORIES: { value: NoteCategory; label: string }[] = [
  { value: "general", label: "General" },
  { value: "academic", label: "Academic" },
  { value: "behavior", label: "Behavior" },
  { value: "family", label: "Family" },
  { value: "medical", label: "Medical" },
  { value: "compliance", label: "Compliance" },
  { value: "financial", label: "Financial" },
];

const CATEGORY_LABEL = new Map(CATEGORIES.map((c) => [c.value, c.label]));

export function EntityNotesPanel({
  organizationId,
  schoolId,
  entityType,
  entityId,
  studentId,
  familyId,
  notes,
  title = "Notes",
}: {
  organizationId: string | null;
  schoolId: string | null;
  entityType: string;
  entityId: string;
  studentId?: string | null;
  familyId?: string | null;
  notes: PlatformNote[];
  title?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<NoteCategory>("general");
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const action = useActionFeedback({
    verb: "create",
    labels: { idle: "Add note", loading: "Saving…", success: "✓ Saved" },
    successToast: "✓ Note saved.",
    errorToast: "Unable to save note.",
    progressLabel: "Saving note…",
    onError: (err) => setError(err.message),
  });

  const pinAction = useActionFeedback({
    verb: "save",
    successToast: false,
    errorToast: "Unable to change that note.",
    onError: (err) => setError(err.message),
  });

  function submit() {
    const text = body.trim();
    if (!text) return;
    setError(null);

    void action.run(async () => {
      const form = new FormData();
      form.set("organization_id", organizationId ?? "");
      form.set("school_id", schoolId ?? "");
      form.set("entity_type", entityType);
      form.set("entity_id", entityId);
      form.set("body", text);
      form.set("category", category);
      form.set("visibility", "staff");
      form.set("is_pinned", pinned ? "true" : "false");
      if (studentId) form.set("student_id", studentId);
      if (familyId) form.set("family_id", familyId);

      const result = await createPlatformNoteAction(form);
      if (result && "error" in result && result.error) throw new Error(result.error);

      setBody("");
      setCategory("general");
      setPinned(false);
      // The list is server-rendered, so nothing here would change without it.
      router.refresh();
      return result;
    });
  }

  function togglePin(note: PlatformNote) {
    setError(null);
    void pinAction.run(async () => {
      const form = new FormData();
      form.set("note_id", note.id);
      // `pinned` here, `is_pinned` on create. The two server actions read
      // different field names for the same idea, and sending the wrong one is
      // silent: the value reads as absent, so the note quietly stays unpinned
      // and the button appears to do nothing.
      form.set("pinned", note.is_pinned ? "false" : "true");
      form.set("entity_type", entityType);
      form.set("entity_id", entityId);
      const result = await pinPlatformNoteAction(form);
      if (result && "error" in result && result.error) throw new Error(result.error);
      router.refresh();
      return result;
    });
  }

  return (
    <ProfileCard title={title}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="What should the next person to open this record know?"
          aria-label="Note"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-500">
            <span className="sr-only">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as NoteCategory)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          {/* Pinning is what keeps "carries an EpiPen" above eighteen months of
              routine notes. Offered at the moment of writing, because that is
              when somebody knows it matters. */}
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="rounded border-slate-300"
            />
            Pin to the top
          </label>

          <ActionButton
            type="submit"
            status={action.status}
            verb="create"
            disabled={!body.trim()}
            labels={{ idle: "Add note", loading: "Saving…", success: "✓ Saved" }}
            errorMessage={action.errorMessage}
          />
        </div>

        <p className="text-xs text-slate-400">
          Staff only. Notes are permanent and show who wrote them.
        </p>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </form>

      <ul className="mt-5 space-y-3">
        {notes.map((note) => (
          <li
            key={note.id}
            className={`rounded-xl px-3 py-2 ${
              note.is_pinned ? "bg-amber-50 ring-1 ring-amber-200" : "bg-slate-50"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {note.is_pinned && (
                <span className="font-medium text-amber-700">Pinned</span>
              )}
              <span className="text-slate-500">
                {CATEGORY_LABEL.get(note.category) ?? note.category}
              </span>
              <button
                type="button"
                onClick={() => togglePin(note)}
                disabled={pinAction.isBusy}
                className="ml-auto text-slate-400 underline-offset-2 hover:text-slate-700 hover:underline disabled:opacity-50"
              >
                {note.is_pinned ? "Unpin" : "Pin"}
              </button>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {note.body}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {note.users?.full_name ?? "Staff"} ·{" "}
              {new Date(note.created_at).toLocaleString()}
            </p>
          </li>
        ))}
        {notes.length === 0 && (
          <p className="text-sm text-slate-400">
            No notes yet. The first one is usually the most useful.
          </p>
        )}
      </ul>
    </ProfileCard>
  );
}
