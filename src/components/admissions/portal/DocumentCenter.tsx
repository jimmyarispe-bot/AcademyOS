"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  deleteApplicationDocument,
  registerApplicationDocument,
  registerScholarshipDocument,
} from "@/lib/admissions/portal/actions";
import { portalInputClass, portalLabelClass, portalSectionClass } from "./styles";

const ADMISSIONS_BUCKET = "admissions-documents";

interface DocumentUploadFieldProps {
  applicationId: string;
  documentType: string;
  documentSubtype?: string | null;
  label: string;
  required?: boolean;
  existingFileName?: string | null;
  existingDocumentId?: string | null;
  scholarshipApplicationId?: string | null;
  mode?: "application" | "scholarship";
}

export function DocumentUploadField({
  applicationId,
  documentType,
  documentSubtype = null,
  label,
  required = false,
  existingFileName,
  existingDocumentId,
  scholarshipApplicationId,
  mode = "application",
}: DocumentUploadFieldProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState(existingFileName ?? null);
  const [documentId, setDocumentId] = useState(existingDocumentId ?? null);

  async function handleUpload(file: File) {
    setError(null);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${applicationId}/${documentType}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(ADMISSIONS_BUCKET)
      .upload(path, file, { upsert: false });

    if (uploadError) {
      setError(uploadError.message);
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("application_id", applicationId);
      formData.set("document_type", documentType);
      formData.set("file_name", file.name);
      formData.set("storage_path", path);
      formData.set("mime_type", file.type);
      formData.set("file_size_bytes", String(file.size));
      if (documentSubtype) formData.set("document_subtype", documentSubtype);

      const result =
        mode === "scholarship" && scholarshipApplicationId
          ? await registerScholarshipDocument(
              (() => {
                formData.set("scholarship_application_id", scholarshipApplicationId);
                return formData;
              })()
            )
          : await registerApplicationDocument(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      setFileName(file.name);
    });
  }

  function handleRemove() {
    if (!documentId) return;
    startTransition(async () => {
      const result = await deleteApplicationDocument(documentId, applicationId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setFileName(null);
      setDocumentId(null);
    });
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900">
            {label}
            {required && <span className="text-red-500"> *</span>}
          </p>
          {fileName ? (
            <p className="mt-1 text-xs text-emerald-700">Uploaded: {fileName}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">PDF, JPG, or PNG up to 10 MB</p>
          )}
        </div>
        <div className="flex gap-2">
          {fileName && mode === "application" && documentId && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleRemove}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
            >
              Remove
            </button>
          )}
          <label className="cursor-pointer rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            {fileName ? "Replace" : "Upload"}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              disabled={isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
              }}
            />
          </label>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface DocumentCenterProps {
  applicationId: string;
  applicationDocuments: {
    id: string;
    document_type: string;
    document_subtype: string | null;
    file_name: string;
  }[];
  stateFundingDocuments: {
    id: string;
    document_type: string;
    file_name: string;
  }[];
  showStateFunding?: boolean;
}

export function DocumentCenter({
  applicationId,
  applicationDocuments,
  stateFundingDocuments,
  showStateFunding = false,
}: DocumentCenterProps) {
  const findDoc = (type: string, subtype?: string | null) =>
    applicationDocuments.find(
      (d) => d.document_type === type && (subtype ? d.document_subtype === subtype : true)
    );

  return (
    <div className={`${portalSectionClass} space-y-6`}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Document Center</h2>
        <p className="text-sm text-slate-500">
          Upload required enrollment documents securely.
        </p>
      </div>

      <div className="space-y-3">
        <DocumentUploadField
          applicationId={applicationId}
          documentType="birth_certificate"
          label="Birth Certificate"
          required
          existingFileName={findDoc("birth_certificate")?.file_name}
          existingDocumentId={findDoc("birth_certificate")?.id}
        />
        <DocumentUploadField
          applicationId={applicationId}
          documentType="report_card"
          label="Most Recent Report Card"
          required
          existingFileName={findDoc("report_card")?.file_name}
          existingDocumentId={findDoc("report_card")?.id}
        />
        <DocumentUploadField
          applicationId={applicationId}
          documentType="immunization"
          label="Immunization Records"
          required
          existingFileName={findDoc("immunization")?.file_name}
          existingDocumentId={findDoc("immunization")?.id}
        />
      </div>

      {showStateFunding && (
        <div className="space-y-3 border-t border-slate-100 pt-6">
          <h3 className="text-sm font-semibold text-slate-900">State Funding Documents</h3>
          {["esa_award_letter", "state_enrollment_form", "proof_of_residency"].map((type) => {
            const doc =
              stateFundingDocuments.find((d) => d.document_type === type) ??
              findDoc(type, "state_funding");
            const labels: Record<string, string> = {
              esa_award_letter: "State Funding Award Letter",
              state_enrollment_form: "State Enrollment Form",
              proof_of_residency: "Proof of Residency",
            };
            return (
              <DocumentUploadField
                key={type}
                applicationId={applicationId}
                documentType={type}
                documentSubtype="state_funding"
                label={labels[type]}
                required
                existingFileName={doc?.file_name}
                existingDocumentId={doc?.id}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface FinancialAidDocumentCenterProps {
  applicationId: string;
  scholarshipApplicationId: string;
  documents: { id: string; document_type: string; file_name: string }[];
}

export function FinancialAidDocumentCenter({
  applicationId,
  scholarshipApplicationId,
  documents,
}: FinancialAidDocumentCenterProps) {
  const findDoc = (type: string) => documents.find((d) => d.document_type === type);

  return (
    <div className={`${portalSectionClass} space-y-4`}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Financial Aid Documents</h2>
        <p className="text-sm text-slate-500">
          Upload documents required for scholarship review.
        </p>
      </div>
      <DocumentUploadField
        applicationId={applicationId}
        documentType="tax_return"
        label="Most Recent Tax Return"
        required
        mode="scholarship"
        scholarshipApplicationId={scholarshipApplicationId}
        existingFileName={findDoc("tax_return")?.file_name}
      />
      <DocumentUploadField
        applicationId={applicationId}
        documentType="pay_stub"
        label="Recent Pay Stub"
        mode="scholarship"
        scholarshipApplicationId={scholarshipApplicationId}
        existingFileName={findDoc("pay_stub")?.file_name}
      />
    </div>
  );
}

export function ApplicationDetailsForm({
  applicationId,
  defaults,
}: {
  applicationId: string;
  defaults: {
    previous_school: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    learning_needs_summary: string | null;
  };
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const formData = new FormData(e.currentTarget);
    formData.set("application_id", applicationId);

    startTransition(async () => {
      const { saveApplicationDetails } = await import("@/lib/admissions/portal/actions");
      const result = await saveApplicationDetails(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className={`${portalSectionClass} space-y-4`}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Application Information</h2>
        <p className="text-sm text-slate-500">Complete the enrollment application details.</p>
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {saved && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Application details saved.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={portalLabelClass} htmlFor="previous_school">Previous School *</label>
          <input
            id="previous_school"
            name="previous_school"
            required
            defaultValue={defaults.previous_school ?? ""}
            className={portalInputClass}
          />
        </div>
        <div>
          <label className={portalLabelClass} htmlFor="emergency_contact_name">
            Emergency Contact Name *
          </label>
          <input
            id="emergency_contact_name"
            name="emergency_contact_name"
            required
            defaultValue={defaults.emergency_contact_name ?? ""}
            className={portalInputClass}
          />
        </div>
        <div>
          <label className={portalLabelClass} htmlFor="emergency_contact_phone">
            Emergency Contact Phone *
          </label>
          <input
            id="emergency_contact_phone"
            name="emergency_contact_phone"
            required
            defaultValue={defaults.emergency_contact_phone ?? ""}
            className={portalInputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={portalLabelClass} htmlFor="learning_needs_summary">
            Learning Needs or Accommodations
          </label>
          <textarea
            id="learning_needs_summary"
            name="learning_needs_summary"
            rows={4}
            defaultValue={defaults.learning_needs_summary ?? ""}
            className={portalInputClass}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save Application"}
        </button>
      </div>
    </form>
  );
}
