"use client";

import Link from "next/link";
import { useTransition } from "react";
import {
  duplicateWorkflow,
  publishWorkflow,
  archiveWorkflow,
  createWorkflowDraftFromActive,
  saveWorkflow,
  saveWorkflowStep,
  toggleWorkflow,
} from "@/lib/admissions/automation/server-actions";
import {
  TRIGGER_EVENT_LABELS,
  type WorkflowDefinition,
  type WorkflowStep,
} from "@/lib/admissions/automation/types";

interface WorkflowBuilderProps {
  workflows: WorkflowDefinition[];
  selectedWorkflow: WorkflowDefinition | null;
  steps: WorkflowStep[];
  schools: { id: string; name: string }[];
}

export function WorkflowBuilder({
  workflows,
  selectedWorkflow,
  steps,
  schools,
}: WorkflowBuilderProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-1">
        <h3 className="text-sm font-semibold text-slate-900">Workflows</h3>
        {workflows.map((wf) => (
          <div
            key={wf.id}
            className={`rounded-xl border p-4 ${
              selectedWorkflow?.id === wf.id
                ? "border-brand-300 bg-brand-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link
                  href={`/dashboard/admissions/workflows?id=${wf.id}`}
                  className="font-medium text-slate-900 hover:text-brand-600"
                >
                  {wf.name}
                </Link>
                <p className="mt-1 text-xs text-slate-500">
                  {TRIGGER_EVENT_LABELS[wf.trigger_event as keyof typeof TRIGGER_EVENT_LABELS] ??
                    wf.trigger_event}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  wf.lifecycle_status === "active"
                    ? "bg-emerald-100 text-emerald-700"
                    : wf.lifecycle_status === "draft"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {wf.lifecycle_status ?? "active"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await toggleWorkflow(wf.id, !wf.is_active);
                  })
                }
                className="text-xs font-medium text-brand-600"
              >
                {wf.is_active ? "Disable" : "Enable"}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await duplicateWorkflow(wf.id);
                  })
                }
                className="text-xs font-medium text-slate-600"
              >
                Duplicate
              </button>
              {wf.lifecycle_status === "draft" && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await publishWorkflow(wf.id);
                    })
                  }
                  className="text-xs font-medium text-emerald-600"
                >
                  Publish
                </button>
              )}
              {wf.lifecycle_status === "active" && (
                <>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await createWorkflowDraftFromActive(wf.id);
                      })
                    }
                    className="text-xs font-medium text-brand-600"
                  >
                    Edit as draft
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await archiveWorkflow(wf.id);
                      })
                    }
                    className="text-xs font-medium text-red-600"
                  >
                    Archive
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4 lg:col-span-2">
        {selectedWorkflow ? (
          <>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
              <h3 className="text-lg font-semibold text-slate-900">{selectedWorkflow.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{selectedWorkflow.description}</p>
              <p className="mt-2 text-xs text-slate-400">
                Trigger: {selectedWorkflow.trigger_event} · Category: {selectedWorkflow.category}
                {selectedWorkflow.school_id
                  ? ` · School override`
                  : " · Org-wide"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
              <h4 className="text-sm font-semibold text-slate-900">Workflow Steps</h4>
              <p className="mt-1 text-xs text-slate-500">
                Trigger → Condition(s) → Action(s) → Delay → Notifications → Completion
              </p>
              <div className="mt-4 space-y-3">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                        {index + 1}
                      </span>
                      {index < steps.length - 1 && (
                        <span className="mt-1 h-full w-px bg-slate-200" />
                      )}
                    </div>
                    <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
                          {step.step_type}
                        </span>
                        {step.action_type && (
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                            {step.action_type.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                      {Object.keys(step.config).length > 0 && (
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-2 text-xs text-slate-600">
                          {JSON.stringify(step.config, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <form
              className="rounded-2xl border border-slate-200/80 bg-white p-6 space-y-4"
              action={(fd) => {
                startTransition(async () => {
                  await saveWorkflowStep(fd);
                });
              }}
            >
              <h4 className="text-sm font-semibold text-slate-900">Add Step</h4>
              <input type="hidden" name="workflow_id" value={selectedWorkflow.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <select name="step_type" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="action">Action</option>
                  <option value="condition">Condition</option>
                  <option value="delay">Delay</option>
                  <option value="notification">Notification</option>
                  <option value="escalation">Escalation</option>
                </select>
                <select name="action_type" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="">—</option>
                  <option value="trigger_communications">Run Communication Templates</option>
                  <option value="create_internal_task">Create Internal Task</option>
                  <option value="send_email">Send Email</option>
                  <option value="send_sms">Send SMS</option>
                  <option value="send_portal_notification">Portal Notification</option>
                  <option value="notify_admissions">Notify Admissions</option>
                  <option value="notify_school_leader">Notify School Leader</option>
                  <option value="generate_enrollment_packet">Generate Enrollment Packet</option>
                  <option value="audit_log_entry">Audit Log Entry</option>
                </select>
              </div>
              <textarea
                name="config"
                rows={4}
                placeholder='{"task_name":"Follow up","due_days":3}'
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                defaultValue="{}"
              />
              <input type="hidden" name="step_order" value={String(steps.length + 1)} />
              <button
                type="submit"
                disabled={isPending}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Add step
              </button>
            </form>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center text-sm text-slate-500">
            Select a workflow to view and edit its steps.
          </div>
        )}

        <form
          className="rounded-2xl border border-slate-200/80 bg-white p-6 space-y-4"
          action={(fd) => {
            startTransition(async () => {
              await saveWorkflow(fd);
            });
          }}
        >
          <h4 className="text-sm font-semibold text-slate-900">Create School Workflow</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <select name="school_id" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              name="workflow_key"
              placeholder="workflow_key"
              required
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              name="name"
              placeholder="Workflow name"
              required
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <select name="trigger_event" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {Object.entries(TRIGGER_EVENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <input type="hidden" name="category" value="general" />
          <input type="hidden" name="sort_order" value="100" />
          <button
            type="submit"
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Create workflow
          </button>
        </form>
      </div>
    </div>
  );
}
