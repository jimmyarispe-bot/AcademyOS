import Link from "next/link";

export function ApplyShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail?: string | null;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <Link href="/apply" className="text-lg font-bold text-brand-700">
              AcademyOS Admissions
            </Link>
            <p className="text-xs text-slate-500">Enrollment inquiry & application portal</p>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/apply" className="text-slate-600 hover:text-slate-900">
              Inquiry
            </Link>
            <Link href="/apply/portal" className="text-slate-600 hover:text-slate-900">
              My Applications
            </Link>
            <Link href="/apply/portal/finance" className="text-slate-600 hover:text-slate-900">
              Billing
            </Link>
            <Link href="/portal" className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
              Family Portal
            </Link>
            {userEmail ? (
              <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 sm:inline">
                {userEmail}
              </span>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
              >
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
