"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useGlobalProgress } from "./GlobalProgress";

/**
 * The progress bar, for links as well as buttons.
 *
 * Pressing Save has shown a bar at the top of the page since the action system
 * was built. Clicking a link showed nothing at all — and a link is the more
 * common thing to press. The page you are on stays fully rendered and
 * interactive while the next one is fetched, so a slow section looks exactly
 * like a click that missed, and the reasonable response to a click that missed
 * is to click again.
 *
 * WHY A DOCUMENT CLICK LISTENER AND NOT A NEXT.JS API. The App Router has no
 * router-events hook. `useLinkStatus` is the documented tool and it reports on
 * one `<Link>` from inside that link's own subtree, so using it would mean
 * editing every link in the product and remembering to do so for every link
 * anybody adds. Listening once, at the document, covers every link that exists
 * and every link that will exist, including the ones written as plain anchors.
 *
 * WHAT STOPS IT. The pathname or the query string changing — which is what a
 * completed navigation looks like from here. The query string matters as much
 * as the path: a case page moves between its sections with `?section=`, so
 * watching the path alone would leave the bar running forever on exactly the
 * screens somebody uses most.
 *
 * AND A TIMEOUT, because a bar that never stops is worse than no bar. Some
 * clicks legitimately change nothing — a link to the page you are already on,
 * a navigation the router rejects — and after ten seconds this assumes that is
 * what happened rather than insisting something is still loading.
 */
const NAVIGATION_TIMEOUT_MS = 10_000;

function isPlainLeftClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  );
}

export function NavigationProgress() {
  const progress = useGlobalProgress();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);

  // The destination arrived — or the click went nowhere and the timeout fired.
  const key = `${pathname}?${searchParams?.toString() ?? ""}`;
  useEffect(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (running.current) {
      running.current = false;
      progress.hide();
    }
    // `key` is the whole point of this effect: it re-runs when the URL settles.
  }, [key, progress]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!isPlainLeftClick(event)) return;

      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      // Anything that opens elsewhere is not this page's business.
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href") ?? "";
      if (!href || href.startsWith("#")) return;

      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (destination.origin !== window.location.origin) return;

      // A link to exactly where you already are navigates nowhere, so nothing
      // would ever stop the bar. Jumping to an anchor on the same page is the
      // same case.
      const here = new URL(window.location.href);
      if (
        destination.pathname === here.pathname &&
        destination.search === here.search
      ) {
        return;
      }

      running.current = true;
      // Showing the bar is the whole of it: the provider puts the page into its
      // busy state — bar and waiting cursor — for anything that reports here,
      // so a followed link and a pressed button look the same.
      progress.show("Loading…");

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        running.current = false;
        progress.hide();
      }, NAVIGATION_TIMEOUT_MS);
    }

    // Capture, so a link whose own handler stops propagation still counts.
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [progress]);

  return null;
}
