"use client";

import { useState } from "react";
import type { PublicInquiryLinks } from "@/lib/admissions/public-form-links";

/**
 * The address parents use, on the screen staff actually open.
 *
 * The point is copy-and-paste, not navigation — there was already a link that
 * opened the form, and it answered the wrong question. What nobody could find
 * was the URL to hand to a website, a flyer, or a parent on the phone.
 *
 * Client-side only for the clipboard. Every URL is also a real anchor, so the
 * panel still works if the copy button is unavailable — a sandboxed iframe, an
 * insecure origin, or a browser that refuses clipboard access.
 */
export function PublicInquiryLinkPanel({ links }: { links: PublicInquiryLinks }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      window.setTimeout(() => setCopied((c) => (c === url ? null : c)), 2000);
    } catch {
      // Clipboard refused. The anchor beside it still works, so say nothing
      // rather than throw an error at somebody who can right-click and copy.
      setCopied(null);
    }
  }

  const primary = links.urls[0] ?? null;
  const alternates = links.urls.slice(1);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Parent inquiry link</h2>
        <p className="text-xs text-slate-500">
          Put this on the school websites. Families who submit it land in JAG automatically.
        </p>
      </div>

      {links.unavailable ? (
        /* The reason, never a blank box. A panel that renders nothing when the
           mapping is missing repeats the exact failure it exists to surface. */
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {links.unavailable}
        </div>
      ) : null}

      {primary ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800">
            {primary}
          </code>
          <button
            type="button"
            onClick={() => copy(primary)}
            className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
          >
            {copied === primary ? "Copied" : "Copy"}
          </button>
          <a
            href={primary}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Open
          </a>
        </div>
      ) : null}

      {alternates.length ? (
        <div className="mt-2 space-y-1">
          {alternates.map((url) => (
            <div key={url} className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-600">
                {url}
              </code>
              <button
                type="button"
                onClick={() => copy(url)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
              >
                {copied === url ? "Copied" : "Copy"}
              </button>
            </div>
          ))}
          <p className="text-[11px] text-slate-400">
            Every address above serves the same form. Any of them is safe to publish.
          </p>
        </div>
      ) : null}

      {links.campuses.length ? (
        <p className="mt-3 text-xs text-slate-500">
          <span className="font-medium text-slate-700">Campuses a parent can choose:</span>{" "}
          {links.campuses.map((c) => c.name).join(" · ")}
        </p>
      ) : null}
    </section>
  );
}
