"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { submitApplication } from "@/lib/admissions/portal/actions";
import type { AdmissionsProgress } from "@/lib/admissions/portal/progress";

interface SubmitApplicationButtonProps {
  applicationId: string;
  progress: AdmissionsProgress;
  applicationStatus: string;
}

export function SubmitApplicationButton({
  applicationId,
  progress,
  applicationStatus,
}: SubmitApplicationButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const alreadySubmitted = ["submitted", "under_review", "accepted", "waitlisted", "denied"].includes(
    applicationStatus
  );

  function handleSubmit() {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await submitApplication(applicationId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.autoAccepted) {
        setMessage("Application submitted and automatically accepted. Welcome to AcademyOS!");
      } else {
        setMessage("Application submitted for admissions review.");
      }
      router.refresh();
    });
  }

  if (alreadySubmitted) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Application status: <span className="font-semibold capitalize">{applicationStatus.replace("_", " ")}</span>
        {message && <p className="mt-2">{message}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Submit Application</h2>
      <p className="mt-1 text-sm text-slate-500">
        Submit when all required steps are complete. State funding must be verified by staff before
        automatic acceptance.
      </p>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}

      <button
        type="button"
        disabled={isPending || !progress.readyToSubmit}
        onClick={handleSubmit}
        className="mt-4 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Submitting…" : "Submit Application"}
      </button>

      {!progress.readyToSubmit && (
        <p className="mt-2 text-xs text-slate-400">
          Complete all required sections above before submitting.
        </p>
      )}
    </div>
  );
}
