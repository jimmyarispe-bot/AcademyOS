"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/components/workspace-design-system/utils";

type GlobalProgressState = {
  active: boolean;
  label?: string;
  value?: number;
};

type GlobalProgressApi = {
  state: GlobalProgressState;
  show: (label: string, value?: number) => void;
  setProgress: (value: number, label?: string) => void;
  hide: () => void;
};

/** Stable API — consumers that only call show/hide do not re-render on ticks. */
const GlobalProgressApiContext = createContext<Omit<
  GlobalProgressApi,
  "state"
> | null>(null);

/** Progress state — only the bar (and rare state readers) subscribe. */
const GlobalProgressStateContext = createContext<GlobalProgressState>({
  active: false,
});

export function GlobalProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GlobalProgressState>({ active: false });

  const show = useCallback((label: string, value?: number) => {
    setState({ active: true, label, value });
  }, []);

  const setProgress = useCallback((value: number, label?: string) => {
    setState((prev) => ({
      active: true,
      label: label ?? prev.label,
      value,
    }));
  }, []);

  const hide = useCallback(() => {
    setState({ active: false });
  }, []);

  /**
   * The page says it is busy, once, for everybody.
   *
   * Every action already reports through this provider, so this is the single
   * place that can make a press look like a press without each call site
   * remembering to. The class drives the waiting cursor across the whole
   * document (see globals.css) — a spinner inside a button is easy to miss on a
   * tall page, and the cursor is where the person is already looking.
   *
   * Cleared on unmount as well as on hide, because a class left on <body> by a
   * component that went away is a page that never stops looking busy.
   */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const { body } = document;
    if (state.active) body.classList.add("jag-busy");
    else body.classList.remove("jag-busy");
    return () => body.classList.remove("jag-busy");
  }, [state.active]);

  // P006: keep API stable — do not put `state` in this memo.
  const api = useMemo(() => ({ show, setProgress, hide }), [show, setProgress, hide]);

  return (
    <GlobalProgressApiContext.Provider value={api}>
      <GlobalProgressStateContext.Provider value={state}>
        {children}
        <GlobalProgressBar />
      </GlobalProgressStateContext.Provider>
    </GlobalProgressApiContext.Provider>
  );
}

export function useGlobalProgress(): GlobalProgressApi {
  // P006: subscribe to API only — progress ticks must not re-render action consumers.
  const api = useContext(GlobalProgressApiContext);
  if (!api) {
    return {
      state: { active: false },
      show: () => undefined,
      setProgress: () => undefined,
      hide: () => undefined,
    };
  }
  // `state` kept for API compat; live UI reads GlobalProgressStateContext in the bar.
  return { ...api, state: { active: false } };
}

function GlobalProgressBar() {
  const state = useContext(GlobalProgressStateContext);
  if (!state.active) return null;

  const known = typeof state.value === "number";
  const pct = known ? Math.min(100, Math.max(0, state.value!)) : undefined;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[90]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={state.label ?? "Working"}
    >
      {/* Four pixels, not two. This is the one signal shared by every action
          in the product, and at 2px on a bright header it read as a border. */}
      <div className="h-1 w-full overflow-hidden bg-brand-100">
        <div
          className={cn(
            "h-full bg-brand-600",
            known ? "transition-all duration-300" : "jag-progress-indeterminate"
          )}
          style={known ? { width: `${pct}%` } : undefined}
        />
      </div>
      {state.label ? (
        <p className="sr-only">{state.label}</p>
      ) : null}
    </div>
  );
}
