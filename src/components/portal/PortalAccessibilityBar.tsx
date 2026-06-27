"use client";

import { useEffect, useState } from "react";
import { updatePortalPreferencesAction } from "@/lib/portal/actions";

export function PortalAccessibilityBar() {
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("portal-high-contrast", highContrast);
    document.documentElement.classList.toggle("portal-large-text", largeText);
    document.documentElement.classList.toggle("portal-reduced-motion", reducedMotion);
  }, [highContrast, largeText, reducedMotion]);

  function persist() {
    const fd = new FormData();
    fd.set("accessibility", JSON.stringify({ highContrast, largeText, reducedMotion }));
    fd.set("notifications", JSON.stringify({}));
    void updatePortalPreferencesAction(fd);
  }

  return (
    <div className="border-b border-slate-200 bg-slate-100/80 px-4 py-2 text-xs text-slate-600" role="region" aria-label="Accessibility options">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4">
        <span className="font-medium">Accessibility</span>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={highContrast} onChange={(e) => { setHighContrast(e.target.checked); }} onBlur={persist} />
          High contrast
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={largeText} onChange={(e) => { setLargeText(e.target.checked); }} onBlur={persist} />
          Larger text
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={reducedMotion} onChange={(e) => { setReducedMotion(e.target.checked); }} onBlur={persist} />
          Reduce motion
        </label>
        <span className="text-slate-400">Language: English (i18n-ready)</span>
      </div>
      <style jsx global>{`
        .portal-high-contrast { --tw-bg-opacity: 1; }
        .portal-high-contrast body, .portal-high-contrast .portal-root { background: #000; color: #fff; }
        .portal-high-contrast a { color: #7dd3fc; }
        .portal-large-text .portal-root { font-size: 1.125rem; }
        .portal-reduced-motion * { animation: none !important; transition: none !important; }
      `}</style>
    </div>
  );
}
