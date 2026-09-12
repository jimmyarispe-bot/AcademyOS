import type { ReactNode } from "react";
import { mailtoHref, telHref } from "@/lib/format/contact";

/**
 * An email address or a phone number, as something you can act on.
 *
 * Staff read these on a phone as often as at a desk, and a number that has to
 * be memorised and typed into the dialler is a number that does not get rung.
 * Two components rather than one so the call sites say which is which, and a
 * shared fallback so a missing value renders the same everywhere.
 *
 * Server components on purpose — nothing here needs state, and a "use client"
 * boundary around every contact detail in the product would be a real cost for
 * an anchor tag.
 *
 * WHAT THEY DO NOT DO. They do not reformat what is on screen. The number a
 * family gave is how that family recognises their own number, so the display
 * stays exactly as stored and only the dial target is normalised.
 */

const LINK_CLASS =
  "text-brand-600 underline-offset-2 hover:text-brand-700 hover:underline";

function Fallback({ children }: { children: ReactNode }) {
  return <span className="text-slate-400">{children}</span>;
}

export function EmailLink({
  email,
  className,
  fallback = "—",
}: {
  email: string | null | undefined;
  className?: string;
  fallback?: ReactNode;
}) {
  const href = mailtoHref(email);

  // Something is stored but it is not an address — a note, a placeholder, a
  // typo. Showing it unlinked is honest; hiding it would lose the only contact
  // detail on file.
  if (!href) {
    const raw = email?.trim();
    return raw ? <span className={className}>{raw}</span> : <Fallback>{fallback}</Fallback>;
  }

  return (
    <a href={href} className={className ? `${LINK_CLASS} ${className}` : LINK_CLASS}>
      {email!.trim()}
    </a>
  );
}

export function PhoneLink({
  phone,
  className,
  fallback = "—",
}: {
  phone: string | null | undefined;
  className?: string;
  fallback?: ReactNode;
}) {
  const href = telHref(phone);

  if (!href) {
    const raw = phone?.trim();
    return raw ? <span className={className}>{raw}</span> : <Fallback>{fallback}</Fallback>;
  }

  return (
    <a href={href} className={className ? `${LINK_CLASS} ${className}` : LINK_CLASS}>
      {phone!.trim()}
    </a>
  );
}
