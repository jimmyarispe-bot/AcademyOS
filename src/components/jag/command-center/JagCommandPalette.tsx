"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { searchJagGlobalAction } from "@/lib/jag-command-center/global-search-action";
import type {
  JagSearchResult,
  JagSearchResultGroup,
} from "@/lib/jag-command-center/global-search";
import { JAG_WORKSPACE_QUERY_PARAM } from "@/lib/jag-platform/workspace-mode";

const SEARCH_DEBOUNCE_MS = 220;

/**
 * Persistent JAG global search (header).
 * Query execution is server-authorized via searchJagGlobalAction —
 * the optional catalog prop is unused for result authority (kept for API stability).
 */
export function JagCommandPalette({
  catalog: _catalog,
}: {
  readonly catalog: readonly unknown[];
}) {
  void _catalog;
  const router = useRouter();
  const searchParams = useSearchParams();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [groups, setGroups] = useState<readonly JagSearchResultGroup[]>([]);
  const [flat, setFlat] = useState<readonly JagSearchResult[]>([]);
  const [pending, setPending] = useState(false);
  const [denied, setDenied] = useState(false);
  const [, startTransition] = useTransition();

  const workspace = searchParams.get(JAG_WORKSPACE_QUERY_PARAM);
  const org = searchParams.get("org");

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
    setGroups([]);
    setFlat([]);
    setDenied(false);
    setPending(false);
    dialogRef.current?.close();
  }, []);

  const openPalette = useCallback(() => {
    setOpen(true);
    dialogRef.current?.showModal();
    queueMicrotask(() => inputRef.current?.focus());
  }, []);

  const runSearch = useCallback(
    async (nextQuery: string) => {
      const seq = ++requestSeq.current;
      setPending(true);
      setDenied(false);
      try {
        const response = await searchJagGlobalAction({
          query: nextQuery,
          workspace,
          organizationId: org,
        });
        if (seq !== requestSeq.current) return;
        if (!response.ok) {
          setDenied(response.error === "unauthorized");
          setGroups([]);
          setFlat([]);
          return;
        }
        setGroups(response.groups);
        setFlat(response.results);
        setActive(0);
      } catch {
        if (seq !== requestSeq.current) return;
        setGroups([]);
        setFlat([]);
      } finally {
        if (seq === requestSeq.current) setPending(false);
      }
    },
    [workspace, org]
  );

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, query, runSearch]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialogRef.current?.open) close();
        else openPalette();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, openPalette]);

  function go(item: JagSearchResult) {
    close();
    startTransition(() => {
      router.push(item.href);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="hidden min-w-0 flex-1 items-center gap-2 rounded border border-[var(--jag-border)] bg-[var(--jag-panel)] px-3 py-1.5 text-left text-xs text-[var(--jag-muted)] outline-none hover:border-[var(--jag-border-strong)] focus-visible:border-[var(--jag-border-strong)] sm:flex"
        aria-keyshortcuts="Meta+K Control+K"
        aria-haspopup="dialog"
        data-jag-global-search-trigger=""
      >
        <SearchIcon className="h-3.5 w-3.5 shrink-0 text-[var(--jag-muted-2)]" />
        <span className="min-w-0 flex-1 truncate">Search The JAG...</span>
        <kbd className="rounded border border-[var(--jag-border)] px-1.5 py-0.5 font-[family-name:var(--font-jag-mono)] text-[10px] text-[var(--jag-muted-2)]">
          ⌘K
        </kbd>
      </button>
      <button
        type="button"
        onClick={openPalette}
        className="inline-flex items-center gap-1.5 rounded border border-[var(--jag-border)] bg-[var(--jag-panel)] px-2 py-1.5 text-xs text-[var(--jag-muted)] sm:hidden"
        aria-label="Search The JAG"
        aria-keyshortcuts="Meta+K Control+K"
        data-jag-global-search-trigger-mobile=""
      >
        <SearchIcon className="h-3.5 w-3.5" />
        <span>Search</span>
      </button>

      <dialog
        ref={dialogRef}
        className="jag-command-palette w-[min(36rem,calc(100vw-2rem))] rounded-md border border-[var(--jag-border-strong)] bg-[var(--jag-panel)] p-0 text-[var(--jag-text)] shadow-2xl backdrop:bg-black/60"
        aria-label="Search The JAG"
        onClose={close}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <div className="border-b border-[var(--jag-border)] p-3">
          <label className="sr-only" htmlFor={listId}>
            Search The JAG
          </label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--jag-muted-2)]" />
            <input
              ref={inputRef}
              id={listId}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) =>
                    Math.min(i + 1, Math.max(flat.length - 1, 0))
                  );
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const item = flat[active];
                  if (item) go(item);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  close();
                }
              }}
              placeholder="Search The JAG..."
              className="w-full rounded border border-[var(--jag-border)] bg-[var(--jag-bg)] py-2 pl-9 pr-3 text-sm text-[var(--jag-text)] outline-none placeholder:text-[var(--jag-muted-2)] focus:border-[var(--jag-border-strong)]"
              autoComplete="off"
              role="combobox"
              aria-expanded={open}
              aria-controls={`${listId}-results`}
              aria-autocomplete="list"
              data-jag-global-search-input=""
            />
          </div>
        </div>
        <div
          id={`${listId}-results`}
          role="listbox"
          className="max-h-[min(24rem,50vh)] overflow-y-auto p-2"
        >
          {denied ? (
            <p className="px-2 py-4 text-sm text-[var(--jag-muted)]">
              Search is not available for this session.
            </p>
          ) : pending && flat.length === 0 ? (
            <p className="px-2 py-4 text-sm text-[var(--jag-muted)]">
              Searching…
            </p>
          ) : flat.length === 0 ? (
            <p className="px-2 py-4 text-sm text-[var(--jag-muted)]">
              No results.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.domain} className="mb-2 last:mb-0">
                <p className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--jag-muted-2)]">
                  {group.domain}
                </p>
                <ul className="space-y-0.5">
                  {group.results.map((item) => {
                    const index = flat.findIndex((r) => r.id === item.id);
                    const selected = index === active;
                    return (
                      <li
                        key={item.id}
                        role="option"
                        aria-selected={selected}
                      >
                        <button
                          type="button"
                          className={`flex w-full flex-col rounded px-3 py-2 text-left ${
                            selected
                              ? "bg-[var(--jag-panel-2)]"
                              : "hover:bg-[var(--jag-panel-2)]"
                          }`}
                          onMouseEnter={() => {
                            if (index >= 0) setActive(index);
                          }}
                          onClick={() => go(item)}
                        >
                          <span className="text-sm text-[var(--jag-text)]">
                            {item.title}
                          </span>
                          <span className="text-[11px] text-[var(--jag-muted)]">
                            {item.type.replace(/_/g, " ")}
                            {item.description ? ` · ${item.description}` : ""}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </dialog>
    </>
  );
}

function SearchIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="7"
        cy="7"
        r="4.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M10.5 10.5 13.5 13.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
