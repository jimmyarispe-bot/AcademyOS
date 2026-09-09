import Link from "next/link";

/**
 * A module's route to its intelligence surface — and, where it matters, an
 * honest word about what the page you are standing on does not show.
 *
 * WHY THIS EXISTS. Finance & Billing opens with four tiles reading $0. They are
 * not broken: they count invoices JAG has issued, and JAG has issued none,
 * because Square does the billing. But a founder landing on the money page and
 * being told the network billed nothing is worse than a blank screen, and the
 * page carrying $367,044 of real revenue sat in a different route with nothing
 * pointing at it.
 *
 * JAG composes experiences rather than shipping separate portals
 * (JAG_CONSTITUTION). A module that cannot reach its own analysis is two
 * products wearing one navigation bar.
 *
 * Keep `caveat` for the case where the numbers on THIS page would otherwise
 * mislead. Most modules need only the link.
 */
export function IntelligenceLink({
  title,
  description,
  href,
  linkLabel,
  caveat,
}: {
  /** What the destination is, in the reader's words. */
  title: string;
  /** One line on what they will find there. */
  description: string;
  href: string;
  linkLabel: string;
  /** Why the figures on the current page are not the whole story. Optional. */
  caveat?: string;
}) {
  return (
    <section className="rounded-2xl border border-brand-200 bg-brand-50/60 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-brand-900">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-brand-800/80">{description}</p>
          {caveat ? (
            <p className="mt-2 max-w-2xl text-xs text-brand-800/70">{caveat}</p>
          ) : null}
        </div>
        <Link
          href={href}
          className="shrink-0 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {linkLabel}
        </Link>
      </div>
    </section>
  );
}
