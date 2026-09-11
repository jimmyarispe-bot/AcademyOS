/**
 * Content cache for repository analysis reads.
 *
 * The scanner, the intelligence report and the catalog indexer all read the same
 * few hundred source files, and resetStudioStoreForTests() drops the scan cache
 * in afterEach - so every test rebuilt every report from disk. Enriching the
 * structural surfaces (package manifests, ~300 route handlers) made that
 * roughly twice as expensive and pushed the JS-005 dashboard test past its
 * timeout at 238s.
 *
 * Raw file bytes keyed by absolute path have no object identity to go stale -
 * unlike a derived report, which must be invalidated with the scan it wraps.
 * The tree does not change during a run, and vitest gives each test file its own
 * module registry, so this lives exactly as long as one file's tests and is
 * bounded by the number of files analysed (a few MB).
 */

import { readFileSync } from "node:fs";

const contents = new Map<string, string>();

/** Read a file as utf8, memoized by absolute path. Returns "" if unreadable. */
export function readFileCached(abs: string): string {
  const hit = contents.get(abs);
  if (hit !== undefined) return hit;
  let text: string;
  try {
    text = readFileSync(/* turbopackIgnore: true */ abs, "utf8");
  } catch {
    text = "";
  }
  // Unreadable files are cached as "" too: the retry would fail identically and
  // a missing-file stat is not free when it happens on every rebuild.
  contents.set(abs, text);
  return text;
}

/** Drop everything. Only needed if something mutates the tree mid-process. */
export function clearRepositoryFileCache(): void {
  contents.clear();
}
