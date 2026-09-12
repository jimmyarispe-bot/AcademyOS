"use client";

import { useState } from "react";
import { ActionButton, useActionFeedback } from "@/components/experience-system/feedback";
import { assertActionResult } from "@/components/experience-system/feedback/runMutation";
import { ProfileCard } from "@/components/platform/profile-workspace/ProfilePrimitives";
import { EmailLink } from "@/components/platform/contact/ContactLink";
import { inviteProspectGuardiansAction } from "@/lib/admissions/portal/prospect-invite-actions";
import type { ProspectInviteCandidate } from "@/lib/admissions/portal/prospect-invites";

/**
 * Giving this family a way into the application portal.
 *
 * Until now a family could submit the interest form, receive the thank-you
 * email, and then find every next step behind a login nothing could give them.
 * This is that login.
 *
 * WHY IT ASKS YOU TO TYPE SEND. The button sends real email to a real family and
 * an email that has left cannot be recalled. A parent receiving unexpected
 * login credentials from their child's school, before anybody has spoken to
 * them, is a phone call somebody has to take.
 *
 * WHY SOME ROWS CANNOT BE SELECTED. A guardian with no email has nothing to
 * send to. A guardian whose address already has a JAG account is refused
 * outright — creating an account over an existing one replaces the roles on it,
 * and these addresses are typed by whoever filled in the public form.
 */
export function ProspectPortalInvitePanel({
  leadId,
  candidates,
}: {
  leadId: string;
  candidates: ProspectInviteCandidate[];
}) {
  const invitable = candidates.filter((c) => !c.skip);
  const [selected, setSelected] = useState<string[]>(
    invitable.filter((c) => c.isPrimary).map((c) => c.guardianId)
  );
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const action = useActionFeedback({
    verb: "send",
    successToast: "✓ Invitation sent",
    errorToast: "Not sent.",
    progressLabel: "Creating the account and sending the invitation…",
  });

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function send() {
    setMessage(null);
    void action.run(async () => {
      const fd = new FormData();
      fd.set("lead_id", leadId);
      fd.set("confirm", confirm);
      for (const id of selected) fd.append("guardian_ids", id);
      const result = await inviteProspectGuardiansAction(fd);
      assertActionResult(result);
      const note = (result as { message?: string }).message;
      if (note) setMessage(note);
      setConfirm("");
      return result;
    });
  }

  if (candidates.length === 0) {
    return (
      <ProfileCard title="Application portal access">
        <p className="text-sm text-slate-500">
          No guardian is recorded on this enquiry, so there is nobody to invite.
        </p>
      </ProfileCard>
    );
  }

  return (
    <ProfileCard title="Application portal access">
      <p className="mb-3 text-sm text-slate-600">
        Sending this creates the parent a JAG account and emails them a link to set a
        password. Once they have it they can open their application, upload documents and
        see where things stand.
      </p>

      <ul className="space-y-2">
        {candidates.map((c) => {
          const disabled = Boolean(c.skip);
          return (
            <li
              key={c.guardianId}
              className={`rounded-lg border px-3 py-2 text-sm ${
                disabled ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"
              }`}
            >
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  id={`invite-${c.guardianId}`}
                  disabled={disabled}
                  checked={selected.includes(c.guardianId)}
                  onChange={() => toggle(c.guardianId)}
                />
                <span className="min-w-0">
                  <span className="font-medium text-slate-800">
                    {c.firstName} {c.lastName}
                  </span>
                  {c.isPrimary && (
                    <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                      Primary
                    </span>
                  )}
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {c.email ? <EmailLink email={c.email} /> : "No email address"}
                  </span>
                  {c.skipReason && (
                    <span className="mt-1 block text-xs text-amber-700">{c.skipReason}</span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {invitable.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
          <label htmlFor="prospect-invite-confirm" className="block text-xs font-medium text-slate-600">
            Type SEND to confirm — this emails the family
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="prospect-invite-confirm"
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="SEND"
              className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
            <ActionButton
              type="button"
              status={action.status}
              verb="send"
              labels={{
                idle: selected.length > 1 ? `Invite ${selected.length} parents` : "Invite parent",
                loading: "Sending…",
                success: "✓ Sent",
              }}
              className="!rounded-lg !px-3 !py-1.5 !text-sm"
              disabled={selected.length === 0 || confirm.trim() !== "SEND"}
              onClick={send}
            />
          </div>
        </div>
      )}

      {message && <p className="mt-3 text-sm text-slate-700">{message}</p>}
    </ProfileCard>
  );
}
