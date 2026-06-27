"use client";

import { useTransition } from "react";
import { runSchedulingIntelligenceAction, resolveScheduleConflictAction } from "@/lib/scheduling/actions";

interface RunIntelligenceButtonProps {
  schoolId?: string;
}

export function RunIntelligenceButton({ schoolId }: RunIntelligenceButtonProps) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const fd = new FormData();
          if (schoolId) fd.set("school_id", schoolId);
          await runSchedulingIntelligenceAction(fd);
        });
      }}
      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      {pending ? "Scanning…" : "Run conflict scan"}
    </button>
  );
}

interface ResolveConflictButtonProps {
  conflictId: string;
}

export function ResolveConflictButton({ conflictId }: ResolveConflictButtonProps) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const fd = new FormData();
          fd.set("conflict_id", conflictId);
          await resolveScheduleConflictAction(fd);
        });
      }}
      className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
    >
      {pending ? "…" : "Resolve"}
    </button>
  );
}
