import Link from "next/link";
import { ApplyShell } from "@/components/admissions/portal/ApplyShell";

interface ThankYouPageProps {
  searchParams: Promise<{ lead?: string }>;
}

export default async function ApplyThankYouPage({ searchParams }: ThankYouPageProps) {
  const { lead } = await searchParams;

  return (
    <ApplyShell>
    <div className="mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
        ✓
      </div>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Inquiry Received</h1>
      <p className="mt-2 text-slate-600">
        Thank you for your interest in AcademyOS. Our admissions team will review your inquiry and
        follow up shortly.
      </p>
      {lead && (
        <p className="mt-3 text-xs text-slate-400">Reference: {lead.slice(0, 8).toUpperCase()}</p>
      )}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/login"
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Sign In to Application Portal
        </Link>
        <Link
          href="/apply"
          className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Submit Another Inquiry
        </Link>
      </div>
    </div>
    </ApplyShell>
  );
}
