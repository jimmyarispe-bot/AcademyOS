"use client";

import { useState, useTransition } from "react";
import { updateStateFundingVerification } from "@/lib/admissions/portal/actions";
import { VERIFICATION_STATUS_LABELS } from "@/lib/constants/admissions-portal";
import { fundingSourceLabel } from "@/lib/constants/programs";
import type { PortalStateFundingVerification } from "@/lib/admissions/portal/queries";
import { portalInputClass, portalLabelClass, portalSectionClass } from "./styles";

interface StateFundingVerificationProps {
  applicationId: string;
  leadId: string;
  verifications: PortalStateFundingVerification[];
}

export function StateFundingVerificationPanel({
  applicationId,
  leadId,
  verifications,
}: StateFundingVerificationProps) {
  if (verifications.length === 0) {
    return null;
  }

  return (
    <div className={`${portalSectionClass} space-y-4`}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">State Funding Verification</h2>
        <p className="text-sm text-slate-500">
          Provide your state program ID and upload verification documents in the Document Center.
        </p>
      </div>

      <div className="space-y-4">
        {verifications.map((verification) => (
          <VerificationRow
            key={verification.id}
            verification={verification}
            applicationId={applicationId}
            leadId={leadId}
          />
        ))}
      </div>
    </div>
  );
}

function VerificationRow({
  verification,
  applicationId,
  leadId,
}: {
  verification: PortalStateFundingVerification;
  applicationId: string;
  leadId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const formData = new FormData(e.currentTarget);
    formData.set("verification_id", verification.id);
    formData.set("application_id", applicationId);
    formData.set("lead_id", leadId);

    startTransition(async () => {
      const result = await updateStateFundingVerification(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  const statusClass =
    verification.verification_status === "verified"
      ? "bg-emerald-100 text-emerald-800"
      : verification.verification_status === "rejected"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-900">
          {fundingSourceLabel(verification.funding_source_code)}
        </p>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}>
          {VERIFICATION_STATUS_LABELS[verification.verification_status] ??
            verification.verification_status}
        </span>
      </div>

      {verification.rejection_reason && (
        <p className="text-xs text-red-600">Reason: {verification.rejection_reason}</p>
      )}

      <div>
        <label className={portalLabelClass} htmlFor={`program_id_${verification.id}`}>
          State Program ID / Award Number
        </label>
        <input
          id={`program_id_${verification.id}`}
          name="state_program_id"
          defaultValue={verification.state_program_id ?? ""}
          className={portalInputClass}
          placeholder="e.g. ESA-123456"
        />
      </div>
      <div>
        <label className={portalLabelClass} htmlFor={`notes_${verification.id}`}>Notes</label>
        <textarea
          id={`notes_${verification.id}`}
          name="notes"
          rows={2}
          defaultValue={verification.notes ?? ""}
          className={portalInputClass}
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {saved && <p className="text-xs text-emerald-600">Verification details saved.</p>}

      <button
        type="submit"
        disabled={isPending || verification.verification_status === "verified"}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save Verification Info"}
      </button>
    </form>
  );
}
