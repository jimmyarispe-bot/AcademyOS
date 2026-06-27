"use client";

import { useState, useTransition } from "react";
import { signEnrollmentPacket } from "@/lib/admissions/sprint15-actions";
import type { EnrollmentPacketView } from "@/lib/admissions/enrollment-packets";

interface EnrollmentPacketPanelProps {
  packet: EnrollmentPacketView;
  applicationId: string;
  signerEmail: string;
  readOnly?: boolean;
}

export function EnrollmentPacketPanel({
  packet,
  applicationId,
  signerEmail,
  readOnly = false,
}: EnrollmentPacketPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [signatures, setSignatures] = useState<Record<string, string>>({});

  function handleSign(templateKey: string) {
    const signatureText = signatures[templateKey]?.trim();
    if (!signatureText) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("enrollment_packet_id", packet.id);
      formData.set("template_key", templateKey);
      formData.set("signer_name", signatureText);
      formData.set("signer_email", signerEmail);
      formData.set("signature_text", signatureText);
      formData.set("application_id", applicationId);
      await signEnrollmentPacket(formData);
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Enrollment Packet</h3>
          <p className="text-xs capitalize text-slate-500">
            Status: {packet.packet_status.replace(/_/g, " ")}
          </p>
        </div>
        {packet.completed_at && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
            Completed {new Date(packet.completed_at).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {packet.templates.map((doc) => (
          <div key={doc.template_key} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <h4 className="font-medium text-slate-900">{doc.title}</h4>
            <div
              className="prose prose-sm mt-2 max-w-none text-slate-600"
              dangerouslySetInnerHTML={{ __html: doc.body_html }}
            />
            {doc.signed ? (
              <p className="mt-3 text-xs text-emerald-700">
                Signed by {doc.signature?.signer_name} on{" "}
                {doc.signature?.signed_at
                  ? new Date(doc.signature.signed_at).toLocaleString()
                  : "—"}
              </p>
            ) : doc.requires_signature && !readOnly ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="Type full legal name to sign"
                  value={signatures[doc.template_key] ?? ""}
                  onChange={(e) =>
                    setSignatures((s) => ({ ...s, [doc.template_key]: e.target.value }))
                  }
                  className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                />
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSign(doc.template_key)}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  Sign Electronically
                </button>
              </div>
            ) : !doc.requires_signature ? (
              <p className="mt-2 text-xs text-slate-400">Acknowledgement only — no signature required</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
