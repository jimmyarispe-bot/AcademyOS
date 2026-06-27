"use client";

import { useTransition } from "react";
import Link from "next/link";
import { completeSessionAction, startLessonAction, takeSessionAttendanceAction } from "@/lib/teacher/actions";

interface SessionCardActionsProps {
  sessionId: string;
  students: { id: string; first_name?: string; last_name?: string }[];
  lessonStatus: string;
}

export function SessionCardActions({ sessionId, students, lessonStatus }: SessionCardActionsProps) {
  const [pending, startTransition] = useTransition();
  const firstStudent = students[0];

  return (
    <div className="flex flex-wrap gap-2">
      {lessonStatus === "not_started" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const fd = new FormData();
              fd.set("session_id", sessionId);
              await startLessonAction(fd);
            });
          }}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Start lesson
        </button>
      )}
      <Link
        href={`/dashboard/teacher/sessions/${sessionId}`}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        Open workspace
      </Link>
      {firstStudent && (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const fd = new FormData();
                fd.set("session_id", sessionId);
                fd.set("student_id", firstStudent.id);
                fd.set("status", "present");
                await takeSessionAttendanceAction(fd);
              });
            }}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            Take attendance
          </button>
          <Link
            href={`/dashboard/students/${firstStudent.id}`}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Student profile
          </Link>
        </>
      )}
      <Link
        href={`/dashboard/teacher/sessions/${sessionId}#notes`}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        Record notes
      </Link>
      <Link
        href={`/dashboard/teacher/sessions/${sessionId}#artifacts`}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        Upload artifact
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const fd = new FormData();
            fd.set("session_id", sessionId);
            await completeSessionAction(fd);
          });
        }}
        className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50"
      >
        Complete session
      </button>
    </div>
  );
}
