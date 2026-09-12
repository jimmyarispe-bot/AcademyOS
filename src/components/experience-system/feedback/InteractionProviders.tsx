"use client";

import { Suspense, type ReactNode } from "react";
import { LiveAnnouncerProvider } from "./LiveAnnouncer";
import { ToastProvider } from "./Toast";
import { BackgroundJobsProvider } from "./BackgroundJobs";
import { GlobalProgressProvider } from "./GlobalProgress";
import { NavigationProgress } from "./NavigationProgress";

/**
 * Root interaction stack for The JAG:
 * live announcements → toasts → background jobs → global progress.
 *
 * `NavigationProgress` sits inside the progress provider and renders nothing —
 * it drives the same bar for link clicks that actions already drive for button
 * presses. Wrapped in Suspense because it reads the query string, and reading
 * the query string opts a subtree out of static rendering unless a boundary
 * says where to stop. The boundary costs nothing here: the fallback is null and
 * the component's whole output is null.
 */
export function InteractionProviders({ children }: { children: ReactNode }) {
  return (
    <LiveAnnouncerProvider>
      <ToastProvider>
        <BackgroundJobsProvider>
          <GlobalProgressProvider>
            <Suspense fallback={null}>
              <NavigationProgress />
            </Suspense>
            {children}
          </GlobalProgressProvider>
        </BackgroundJobsProvider>
      </ToastProvider>
    </LiveAnnouncerProvider>
  );
}
