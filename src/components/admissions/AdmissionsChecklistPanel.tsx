"use client";

import { useTransition } from "react";
import { updateChecklistItemStatus } from "@/lib/admissions/sprint15-actions";
import type { ApplicationChecklistItem } from "@/lib/admissions/checklist";

interface AdmissionsChecklistPanelProps {
  applicationId: string;
  leadId: string;
  items: ApplicationChecklistItem[];
  percentComplete: number;
  readOnly?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  completed: "bg-emerald-100 text-emerald-800",
  waived: "bg-blue-100 text-blue-800",
  not_applicable: "bg-slate-100 text-slate-400",
};

export function AdmissionsChecklistPanel({
  applicationId,
  leadId,
  items,
  percentComplete,
  readOnly = false,
}: AdmissionsChecklistPanelProps) {
  const [isPending, startTransition] = useTransition();

  function markComplete(itemId: string, status: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", itemId);
      formData.set("status", status);
      formData.set("application_id", applicationId);
      formData.set("lead_id", leadId);
      await updateChecklistItemStatus(formData);
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Admissions Checklist</h3>
          <p className="text-xs text-slate-500">Dynamic requirements for this applicant</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-brand-600">{percentComplete}%</p>
          <p className="text-xs text-slate-400">Complete</p>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-all"
          style={{ width: `${percentComplete}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">
                {item.template?.label ?? item.item_key}
                {item.template?.is_required && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </p>
              <p className="text-xs capitalize text-slate-400">{item.template?.category}</p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[item.status] ?? STATUS_COLORS.pending}`}
              >
                {item.status.replace(/_/g, " ")}
              </span>
              {!readOnly && item.status === "pending" && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => markComplete(item.id, "completed")}
                  className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  Complete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
