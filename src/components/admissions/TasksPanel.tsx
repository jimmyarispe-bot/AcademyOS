"use client";

import { useState, useTransition } from "react";
import { addLeadTask, completeTask } from "@/lib/admissions/actions";
import type { AdmissionTask } from "@/lib/admissions/queries";

interface TasksPanelProps {
  leadId: string;
  tasks: AdmissionTask[];
}

export function TasksPanel({ leadId, tasks }: TasksPanelProps) {
  const [taskName, setTaskName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!taskName.trim()) return;
    startTransition(async () => {
      await addLeadTask(leadId, taskName.trim(), dueDate || null);
      setTaskName("");
      setDueDate("");
    });
  }

  function handleComplete(taskId: string) {
    startTransition(async () => {
      await completeTask(taskId, leadId);
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900">Tasks</h3>
      <form onSubmit={handleAdd} className="mt-3 flex flex-wrap gap-2">
        <input
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
          placeholder="Task name"
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm min-w-[160px]"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isPending || !taskName.trim()}
          className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>
      <ul className="mt-4 space-y-2">
        {tasks.map((task) => (
          <li
            key={task.id}
            className={`flex items-center justify-between rounded-xl px-3 py-2 ${
              task.task_status === "completed" ? "bg-emerald-50" : "bg-slate-50"
            }`}
          >
            <div>
              <p className={`text-sm ${task.task_status === "completed" ? "text-slate-500 line-through" : "text-slate-900"}`}>
                {task.task_name}
              </p>
              {task.due_date && (
                <p className="text-xs text-slate-400">Due {task.due_date}</p>
              )}
            </div>
            {task.task_status === "open" && (
              <button
                type="button"
                onClick={() => handleComplete(task.id)}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Complete
              </button>
            )}
          </li>
        ))}
        {tasks.length === 0 && (
          <p className="text-sm text-slate-400">No tasks yet.</p>
        )}
      </ul>
    </div>
  );
}
