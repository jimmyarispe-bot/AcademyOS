"use client";

import { useState, useTransition } from "react";
import { submitAdmissionsDecision } from "@/lib/admissions/decisions";

interface DecisionWizardProps {
  leadId: string;
  applicationId?: string | null;
  studentName: string;
}

const DECISIONS = [
  { value: "accept", label: "Accept", description: "Offer enrollment and generate enrollment packet", color: "border-emerald-200 bg-emerald-50" },
  { value: "waitlist", label: "Waitlist", description: "Hold application until seat available", color: "border-amber-200 bg-amber-50" },
  { value: "deny", label: "Deny", description: "Decline application with notification", color: "border-red-200 bg-red-50" },
  { value: "request_info", label: "Request Info", description: "Ask family for additional documents", color: "border-blue-200 bg-blue-50" },
] as const;

export function DecisionWizard({ leadId, applicationId, studentName }: DecisionWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [decision, setDecision] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("lead_id", leadId);
      if (applicationId) formData.set("application_id", applicationId);
      formData.set("decision_type", decision);
      formData.set("decision_notes", notes);
      formData.set("send_email", String(sendEmail));

      const res = await submitAdmissionsDecision(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      setResult("Decision recorded. Tasks created and communication logged.");
      setStep(3);
    });
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-800">
        {result}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
      <h3 className="text-sm font-semibold text-slate-900">Admissions Decision Wizard</h3>
      <p className="mt-1 text-xs text-slate-500">
        Guided decision for {studentName} — replaces manual status changes
      </p>

      {step === 1 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {DECISIONS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => {
                setDecision(d.value);
                setStep(2);
              }}
              className={`rounded-xl border p-4 text-left transition hover:shadow-sm ${d.color}`}
            >
              <p className="font-semibold text-slate-900">{d.label}</p>
              <p className="mt-1 text-xs text-slate-600">{d.description}</p>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="mt-4 space-y-4">
          <p className="text-sm font-medium text-slate-900 capitalize">
            Decision: {decision.replace("_", " ")}
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Personalized message (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Add custom notes to the email..."
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            Log personalized email to guardian
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              Back
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleSubmit}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {isPending ? "Processing…" : "Confirm Decision"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
