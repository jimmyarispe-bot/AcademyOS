"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { GlobalSearchResult } from "@/lib/platform/identity/types";

interface GlobalSearchPanelProps {
  initialQuery?: string;
}

export function GlobalSearchPanel({ initialQuery = "" }: GlobalSearchPanelProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const [searched, setSearched] = useState(false);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch(`/api/platform/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setSearched(true);
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search students, leads, staff…"
          className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={isPending || query.trim().length < 2}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Search
        </button>
      </form>
      <p className="text-xs text-slate-500">
        Results are filtered by your role, school assignments, and permissions. Unauthorized records are never shown.
      </p>
      {searched && results.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No results you are authorized to view.
        </p>
      )}
      <ul className="space-y-2">
        {results.map((r) => (
          <li key={`${r.entityType}-${r.id}`}>
            <Link
              href={r.href}
              className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-300"
            >
              <p className="font-medium text-slate-900">{r.title}</p>
              <p className="text-sm text-slate-500">
                {r.subtitle} · {r.module} · {r.classification}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
