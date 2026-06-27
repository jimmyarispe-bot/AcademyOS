"use client";

import { useTransition } from "react";
import {
  recordBehaviorEvent,
  recordStudentAttendance,
  refreshStudentSuccessScore,
  transitionStudentStage,
} from "@/lib/ssis/actions";

interface StudentSuccessQuickActionsProps {
  studentId: string;
  lifecycleStage: string;
}

export function StudentSuccessQuickActions({
  studentId,
  lifecycleStage,
}: StudentSuccessQuickActionsProps) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-slate-900">Quick Actions</h3>
      <p className="mt-1 text-xs text-slate-500">Record attendance, behavior, or advance lifecycle stage.</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <form
          className="space-y-2 rounded-xl bg-slate-50 p-3"
          action={(fd) => startTransition(() => void recordStudentAttendance(fd))}
        >
          <input type="hidden" name="student_id" value={studentId} />
          <p className="text-xs font-medium uppercase text-slate-500">Attendance</p>
          <select name="status" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" required>
            <option value="present">Present</option>
            <option value="virtual_present">Virtual Present</option>
            <option value="therapy_present">Therapy Present</option>
            <option value="absent_excused">Absent (Excused)</option>
            <option value="absent_unexcused">Absent (Unexcused)</option>
            <option value="tardy">Tardy</option>
            <option value="early_dismissal">Early Dismissal</option>
          </select>
          <select name="attendance_context" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
            <option value="daily">Daily</option>
            <option value="virtual">Virtual</option>
            <option value="therapy">Therapy</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" name="notify_parent" value="true" />
            Notify parent
          </label>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Record
          </button>
        </form>

        <form
          className="space-y-2 rounded-xl bg-slate-50 p-3"
          action={(fd) => startTransition(() => void recordBehaviorEvent(fd))}
        >
          <input type="hidden" name="student_id" value={studentId} />
          <p className="text-xs font-medium uppercase text-slate-500">Behavior</p>
          <select name="event_type" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" required>
            <option value="positive">Positive</option>
            <option value="incident">Incident</option>
            <option value="intervention">Intervention</option>
            <option value="restorative">Restorative</option>
          </select>
          <input
            name="title"
            placeholder="Title"
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            required
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Log Event
          </button>
        </form>

        <form
          className="space-y-2 rounded-xl bg-slate-50 p-3"
          action={(fd) => startTransition(() => void transitionStudentStage(fd))}
        >
          <input type="hidden" name="student_id" value={studentId} />
          <p className="text-xs font-medium uppercase text-slate-500">Lifecycle</p>
          <p className="text-xs text-slate-600">Current: <span className="capitalize">{lifecycleStage}</span></p>
          <select name="to_stage" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" required>
            <option value="active">Active Student</option>
            <option value="graduating">Graduating</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="alumni">Alumni</option>
          </select>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            Transition
          </button>
        </form>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => void refreshStudentSuccessScore(studentId))}
        className="mt-4 text-sm font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
      >
        Refresh Success Score
      </button>
    </div>
  );
}
