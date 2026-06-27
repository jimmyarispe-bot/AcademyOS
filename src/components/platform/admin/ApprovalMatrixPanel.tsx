"use client";

import type { ApprovalRule } from "@/lib/platform/identity/types";

interface ApprovalMatrixPanelProps {
  rules: ApprovalRule[];
}

export function ApprovalMatrixPanel({ rules }: ApprovalMatrixPanelProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Executive Approval Matrix</h2>
        <p className="mt-1 text-sm text-slate-600">
          Configurable approval thresholds without code changes. Rules are evaluated when staff submit
          actions that exceed thresholds (scholarships, tuition overrides, payroll, expulsions).
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Rule</th>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Threshold</th>
              <th className="px-4 py-3">Approvers</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{rule.name}</p>
                  {rule.description && (
                    <p className="mt-0.5 text-xs text-slate-500">{rule.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 capitalize text-slate-600">{rule.module}</td>
                <td className="px-4 py-3 text-slate-600">
                  {rule.threshold_value != null
                    ? `${rule.threshold_value}${rule.threshold_unit === "percent" ? "%" : rule.threshold_unit === "usd" ? " USD" : ""}`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {rule.approver_roles.map((r) => (
                      <span key={r} className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                        {r.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {rule.is_active ? (
                    <span className="text-emerald-600">Active</span>
                  ) : (
                    <span className="text-slate-400">Inactive</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rules.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-500">No approval rules configured.</p>
        )}
      </div>
    </div>
  );
}
