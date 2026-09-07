"use client";

import { useState } from "react";

/**
 * Run the platform queues, on purpose, and say what happened.
 *
 * WHY THIS EXISTS. Until 6 September the Automation Dashboard called
 * processAllPlatformQueues() during render. Every visit — every refresh, every
 * back-button — ran thirty-odd background jobs. That was harmless only while the
 * jobs did nothing: the cron had been authenticating as nobody for months, so
 * every queue came back empty. Once that was fixed, rendering a page started
 * sending real email to real families, with no record that it had happened.
 *
 * It also went through the wrong door. The page called the function directly,
 * bypassing /api/platform/process-queues — which is where recordRun lives. So
 * the one path a human could actually trigger was the one path that never
 * appeared in platform_job_runs, and the run log looked empty no matter how many
 * times anyone loaded the dashboard.
 *
 * This button posts to the route. It runs when asked, it runs as the person who
 * asked, and the run is written down.
 */

interface RunSummary {
  jobsRun?: number;
  durationMs?: number;
  failures?: { name: string; error: string }[];
}

export function RunQueuesButton() {
  const [state, setState] = useState<"idle" | "running">("idle");
  const [result, setResult] = useState<RunSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setState("running");
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/platform/process-queues", { method: "POST" });
      const body = (await res.json().catch(() => null)) as
        | (RunSummary & { error?: string })
        | null;

      // A non-OK response is the interesting case, not the boring one. The old
      // behaviour answered {success:true} whatever happened; say the status.
      if (!res.ok) {
        setError(body?.error ?? `The run was refused (HTTP ${res.status}).`);
        return;
      }
      setResult(body ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setState("idle");
    }
  }

  const failures = result?.failures ?? [];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Run the queues now
          </p>
          <p className="text-xs text-slate-600">
            Processes every pending automation, reminder and scheduled message.
            This sends real email. The run is recorded in the job log.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={state === "running"}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {state === "running" ? "Running…" : "Run now"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-3 space-y-2 text-sm">
          <p className="text-slate-800">
            <span className="font-medium">{result.jobsRun ?? 0}</span> jobs ran in{" "}
            <span className="font-medium">
              {Math.round((result.durationMs ?? 0) / 100) / 10}s
            </span>
            {failures.length === 0
              ? " — none failed."
              : ` — ${failures.length} failed.`}
          </p>
          {/* Naming the failures is the whole point. A count alone sends you
              back to the database to find out which. */}
          {failures.length > 0 && (
            <ul className="space-y-1 rounded-md bg-amber-50 px-3 py-2">
              {failures.map((f) => (
                <li key={f.name} className="text-amber-900">
                  <span className="font-medium">{f.name}</span> — {f.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
