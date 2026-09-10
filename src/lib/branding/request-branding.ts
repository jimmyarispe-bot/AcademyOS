import { headers } from "next/headers";
import { loadOrganizationBranding } from "@/lib/branding";
import { normalizeHost } from "@/lib/platform/organizations/domains";
import { resolveOrganizationByRequestHost } from "@/lib/admissions/interest-form/org-resolve";
import type { OrganizationBranding } from "@/lib/branding/types";

/**
 * Branding resolved from the request HOST, for surfaces with no signed-in user.
 *
 * WHY THIS EXISTS. `loadOrganizationBranding()` finds the organization from the
 * current user. A favicon has no user: the browser asks for it before anybody
 * signs in, and on public pages there is never anybody to ask. So the icon
 * routes resolved nothing and fell back to a hardcoded JAG mark — every
 * subscriber organization got the same letter J in the browser tab.
 *
 * Host resolution is the same path `/apply` already uses:
 * `org_organizations.settings.domains`, matched against the incoming Host
 * header. An unmapped host resolves to null and the caller renders the JAG
 * default, which is the correct answer for a host that is not a subscriber's.
 */

export type RequestBranding = {
  branding: OrganizationBranding | null;
  /** Lower-cased hostname, for turning a relative asset path into an absolute URL. */
  host: string | null;
};

/**
 * ImageResponse fetches images over the network, so a stored `/brand/x.png`
 * has to become `https://host/brand/x.png` before it can be drawn. A URL that
 * is already absolute is returned untouched; anything that is neither is
 * treated as unusable rather than guessed at.
 */
export function absoluteAssetUrl(url: string, host: string | null): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) return trimmed;
  if (trimmed.startsWith("/") && host) return `https://${host}${trimmed}`;
  return null;
}

export async function getRequestBranding(): Promise<RequestBranding> {
  let host: string | null = null;
  try {
    const store = await headers();
    host = normalizeHost(store.get("x-forwarded-host") ?? store.get("host"));
  } catch {
    return { branding: null, host: null };
  }

  if (!host) return { branding: null, host: null };

  try {
    const matched = await resolveOrganizationByRequestHost(host);
    if (!matched) return { branding: null, host };
    const branding = await loadOrganizationBranding(undefined, matched.org.id);
    return { branding, host };
  } catch {
    // A favicon must never take a page down. An unresolvable organization
    // renders the platform default instead.
    return { branding: null, host };
  }
}
