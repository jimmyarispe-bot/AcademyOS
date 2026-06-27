"use client";

import { useState, useTransition } from "react";
import { verifyStateFundingStaff, runStaffAcceptanceCheck } from "@/lib/admissions/portal/actions";
import { VERIFICATION_STATUS_LABELS } from "@/lib/constants/admissions-portal";
import { fundingSourceLabel } from "@/lib/constants/programs";
import type { PortalStateFundingVerification } from "@/lib/admissions/portal/queries";

interface StaffFundingVerificationPanelProps {
  applicationId: string;
  leadId: string;
  verifications: PortalStateFundingVerification[];
}

export function StaffFundingVerificationPanel({
  applicationId,
  leadId,
  verifications,
}: StaffFundingVerificationPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [acceptanceMessage, setAcceptanceMessage] = useState<string | null>(null);

  if (verifications.length === 0) return null;

  function handleVerify(verificationId: string, status: string, rejectionReason?: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("verification_id", verificationId);
      formData.set("application_id", applicationId);
      formData.set("lead_id", leadId);
      formData.set("verification_status", status);
      if (rejectionReason) formData.set("rejection_reason", rejectionReason);

      await verifyStateFundingStaff(formData);
    });
  }

  function handleAcceptanceCheck() {
    startTransition(async () => {
      const result = await runStaffAcceptanceCheck(applicationId, leadId);
      if (result.error) {
        setAcceptanceMessage(result.error);
        return;
      }
      if (result.accepted) {
        setAcceptanceMessage("Automated acceptance workflow completed.");
      } else {
        setAcceptanceMessage(result.reason ?? "Requirements not yet met for acceptance.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">State Funding Verification</h3>
          <p className="mt-1 text-xs text-slate-500">
            Review state program IDs and documents before running acceptance.
          </p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={handleAcceptanceCheck}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Run Acceptance Check
        </button>
      </div>

      {acceptanceMessage && (
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {acceptanceMessage}
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {verifications.map((v) => (
          <li key={v.id} className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-900">
                {fundingSourceLabel(v.funding_source_code)}
              </span>
              <span className="text-xs text-slate-500">
                {VERIFICATION_STATUS_LABELS[v.verification_status] ?? v.verification_status}
              </span>
            </div>
            {v.state_program_id && (
              <p className="mt-1 text-xs text-slate-600">Program ID: {v.state_program_id}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleVerify(v.id, "verified")}
                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white"
              >
                Verify
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleVerify(v.id, "rejected", "Documentation incomplete")}
                className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
