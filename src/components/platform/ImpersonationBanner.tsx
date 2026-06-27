"use client";

import { useTransition } from "react";
import { endImpersonationAction } from "@/lib/platform/identity/server-actions";

interface ImpersonationBannerProps {
  targetName: string;
}

export function ImpersonationBanner({ targetName }: ImpersonationBannerProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <span>
          Acting as <strong>{targetName}</strong>. All actions are logged.
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => { void endImpersonationAction(); })}
          className="rounded-lg bg-amber-700 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50"
        >
          End impersonation
        </button>
      </div>
    </div>
  );
}
