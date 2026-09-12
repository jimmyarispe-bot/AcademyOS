"use client";

import { useState } from "react";
import { inviteGuardiansAction } from "@/lib/portal/parent-invite-actions";
import { ActionButton, useActionFeedback } from "@/components/experience-system/feedback";
import { PARENT_INVITE_BATCH_LIMIT } from "@/lib/portal/parent-invite-limits";
import { EmailLink } from "@/components/platform/contact/ContactLink";

export type InviteRow = {
  guardianId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  familyName: string | null;
  needsConfirmation: boolean;
  skip: "no_email" | "already_linked" | null;
};

const SKIP_REASON: Record<"no_email" | "already_linked", string> = {
  no_email: "No email address",
  already_linked: "Already has an account",
};

/**
 * Nobody is selected by default.
 *
 * A page that arrives with every box ticked and a Send button turns a moment of
 * inattention into 94 emails. Choosing who to invite should take an action, and
 * "select all the invitable ones" is available for when that is genuinely what
 * somebody means.
 */
export function ParentInviteList({
  schoolId,
  schoolName,
  rows,
}: {
  schoolId: string;
  schoolName: string;
  rows: InviteRow[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);

  const invitable = rows.filter((r) => r.skip === null);
  const action = useActionFeedback({
    verb: "send",
    successToast: "Invitations sent",
    errorToast: "Could not send invitations.",
    onError: (err) => setError(err.message),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-slate-600">
          {invitable.length} of {rows.length} can be invited at {schoolName}.
        </span>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          onClick={() =>
            setSelected(new Set(invitable.slice(0, PARENT_INVITE_BATCH_LIMIT).map((r) => r.guardianId)))
          }
        >
          Select all invitable
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => setSelected(new Set())}
        >
          Clear
        </button>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {report && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{report}</p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="w-10 px-3 py-2" />
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Family</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.guardianId} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    disabled={row.skip !== null}
                    checked={selected.has(row.guardianId)}
                    onChange={() => toggle(row.guardianId)}
                    aria-label={`Invite ${row.firstName} ${row.lastName}`}
                  />
                </td>
                <td className="px-3 py-2 text-slate-900">
                  {row.firstName} {row.lastName}
                </td>
                <td className="px-3 py-2 text-slate-600">{row.familyName ?? "—"}</td>
                <td className="px-3 py-2 text-slate-600">
                  <EmailLink email={row.email} />
                </td>
                <td className="px-3 py-2 text-slate-500">
                  {row.skip ? SKIP_REASON[row.skip] : row.needsConfirmation ? "Details unconfirmed" : "Ready"}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  No guardians at this school.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setReport(null);
          const formData = new FormData();
          formData.set("school_id", schoolId);
          formData.set("confirm", confirm);
          for (const id of selected) formData.append("guardian_ids", id);

          void action.run(async () => {
            const result = await inviteGuardiansAction(formData);
            if ("error" in result && result.error) throw new Error(result.error);
            if ("success" in result) {
              const failures = result.failures ?? [];
              setReport(
                `Sent ${result.sent}. Skipped ${result.skipped}.` +
                  (failures.length ? ` Problems: ${failures.join("; ")}` : "")
              );
              setSelected(new Set());
              setConfirm("");
            }
            return result;
          });
        }}
      >
        <div>
          <p className="text-sm text-amber-900">
            This sends a real email to {selected.size} famil{selected.size === 1 ? "y" : "ies"},
            inviting them to set a password. It cannot be undone.
          </p>
          <label className="mt-2 block text-sm text-amber-900" htmlFor="confirm">
            Type SEND to confirm
          </label>
          <input
            id="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 rounded-lg border border-amber-300 px-3 py-2 text-sm"
            placeholder="SEND"
          />
        </div>
        <ActionButton
          type="submit"
          status={action.status}
          verb="send"
          labels={{
            idle: `Send ${selected.size} invitation${selected.size === 1 ? "" : "s"}`,
            loading: "Sending…",
            success: "✓ Sent",
          }}
        />
      </form>
    </div>
  );
}
