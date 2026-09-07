"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type {
  ConnectorDashboardMetrics,
  ConnectorDefinition,
  ConnectorInstallation,
  ConnectorSyncEvent,
  ConnectorSyncJob,
  ScheduleFrequency,
} from "@/lib/connectors";
import {
  GWS_CONNECTOR_ID,
  GWS_SCHEDULES,
  GWS_SERVICES,
  QBO_CONNECTOR_ID,
  QBO_SCHEDULES,
} from "@/lib/connectors";

type OrgOption = { readonly id: string; readonly name: string };

type Props = {
  readonly organizations: readonly OrgOption[];
  readonly organizationId: string;
  readonly organizationName: string;
  readonly catalogGrouped: Readonly<
    Record<string, readonly ConnectorDefinition[]>
  >;
  readonly installations: readonly ConnectorInstallation[];
  readonly metrics: ConnectorDashboardMetrics;
  readonly syncJobs: readonly ConnectorSyncJob[];
  readonly syncEventsByJobId: Readonly<
    Record<string, readonly ConnectorSyncEvent[]>
  >;
  readonly flash?: string | null;
};

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

export function JagConnectorsDashboard({
  organizations,
  organizationId,
  organizationName,
  catalogGrouped,
  installations,
  metrics,
  syncJobs,
  syncEventsByJobId,
  flash,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const installationByConnector = useMemo(() => {
    const map = new Map<string, ConnectorInstallation>();
    for (const row of installations) {
      map.set(row.connectorId, row);
    }
    return map;
  }, [installations]);

  const catalogFlat = useMemo(
    () => Object.values(catalogGrouped).flat(),
    [catalogGrouped]
  );

  const qbo = installationByConnector.get(QBO_CONNECTOR_ID);
  const gws = installationByConnector.get(GWS_CONNECTOR_ID);

  function refresh() {
    router.refresh();
  }

  /**
   * Start a REAL QuickBooks OAuth round trip.
   *
   * This was `connectQbo(demo = true)`, called from the Connect button as
   * `connectQbo(true)`. The route reads:
   *
   *     const useDemo = body.demo === true || !configured;
   *
   * so sending demo:true took the demo branch WHETHER OR NOT live Intuit
   * credentials existed. The response then carried no authorizeUrl, the check
   * below fell through to refresh(), and a fake installation went into the
   * in-memory connector store on whichever lambda served the POST -- which the
   * page re-render does not see. The button did nothing, visibly, and would
   * have done exactly nothing with perfect production keys.
   *
   * `demo` is no longer sent. The ROUTE decides, from whether credentials are
   * configured. And when it does fall back to demo, that is now stated rather
   * than swallowed: a connector reporting a connection to nothing is the whole
   * failure this page kept reproducing.
   */
  async function connectQbo() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/jag-platform/connectors/quickbooks/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        authorizeUrl?: string;
        demo?: boolean;
        message?: string;
      };
      if (!data.ok) {
        setError(data.error ?? "Unable to connect QuickBooks.");
        return;
      }
      if (data.authorizeUrl) {
        window.location.href = data.authorizeUrl;
        return;
      }
      // No authorizeUrl means the server had no live credentials and fell back
      // to a demo connection. Say so. Do not present it as a connection.
      setError(
        data.message ??
          "QuickBooks is not configured for live OAuth. Set QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET and QUICKBOOKS_ENVIRONMENT=production in Vercel, then redeploy."
      );
      refresh();
    });
  }

  async function disconnectQbo() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        "/api/jag-platform/connectors/quickbooks/disconnect",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId }),
        }
      );
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Unable to disconnect.");
        return;
      }
      refresh();
    });
  }

  async function reconnectQbo() {
    setError(null);
    startTransition(async () => {
      // Same fault as connectQbo had: demo:true was hardcoded, so "reconnect"
      // could never start a real OAuth round trip either. The route decides.
      const res = await fetch(
        "/api/jag-platform/connectors/quickbooks/reconnect",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId }),
        }
      );
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        authorizeUrl?: string;
        message?: string;
      };
      if (!data.ok) {
        setError(data.error ?? "Unable to reconnect.");
        return;
      }
      if (data.authorizeUrl) {
        window.location.href = data.authorizeUrl;
        return;
      }
      setError(
        data.message ??
          "QuickBooks is not configured for live OAuth. Set the QUICKBOOKS_* variables in Vercel and redeploy."
      );
      refresh();
    });
  }

  async function syncQbo(retryJobId?: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/jag-platform/connectors/quickbooks/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, retryJobId }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Sync failed.");
        return;
      }
      refresh();
    });
  }

  async function setQboSchedule(scheduleFrequency: ScheduleFrequency) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        "/api/jag-platform/connectors/quickbooks/schedule",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId, scheduleFrequency }),
        }
      );
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Unable to update schedule.");
        return;
      }
      refresh();
    });
  }

  async function connectGws(demo = true) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/jag-platform/connectors/google/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, demo }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        authorizeUrl?: string;
      };
      if (!data.ok) {
        setError(data.error ?? "Unable to connect Google Workspace.");
        return;
      }
      if (data.authorizeUrl) {
        window.location.href = data.authorizeUrl;
        return;
      }
      refresh();
    });
  }

  async function disconnectGws() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/jag-platform/connectors/google/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Unable to disconnect.");
        return;
      }
      refresh();
    });
  }

  async function syncGws() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/jag-platform/connectors/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Sync failed.");
        return;
      }
      refresh();
    });
  }

  async function setGwsSchedule(scheduleFrequency: ScheduleFrequency) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/jag-platform/connectors/google/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, scheduleFrequency }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Unable to update schedule.");
        return;
      }
      refresh();
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            The JAG™
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Connectors™
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Integration infrastructure for {organizationName}. QuickBooks Online
            and Google Workspace connectors are available for evidence ingestion.
          </p>
        </div>
        <label className="text-sm text-slate-600">
          Organization
          <select
            className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-900"
            value={organizationId}
            onChange={(e) => {
              router.push(
                `/jag/connectors?org=${encodeURIComponent(e.target.value)}`
              );
            }}
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {flash ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {flash}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Metric label="Installed Connectors" value={metrics.installedConnectors} />
        <Metric label="Connected Systems" value={metrics.connectedSystems} />
        <Metric label="Healthy Connectors" value={metrics.healthyConnectors} />
        <Metric label="Failed Syncs" value={metrics.failedSyncs} />
        <Metric label="Pending Syncs" value={metrics.pendingSyncs} />
        <Metric label="Last Activity" value={formatWhen(metrics.lastActivity)} />
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          QuickBooks Online Connector™
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Authenticate, sync financial reports into the Evidence Pipeline™, and
          track health. No AI analysis in this connector.
        </p>

        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                QuickBooks Online
              </h3>
              <p className="text-xs text-slate-500">Finance · OAuth 2.0 · v1.0.0</p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                qbo?.status === "Connected"
                  ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                  : qbo?.status === "Error"
                    ? "bg-rose-50 text-rose-900 ring-rose-200"
                    : "bg-slate-100 text-slate-700 ring-slate-200"
              }`}
            >
              {qbo?.status === "Connected" ? "Connected" : qbo?.status ?? "Not Connected"}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-slate-600 md:grid-cols-3">
            <div>
              <dt className="text-slate-400">Company Name</dt>
              <dd className="font-medium text-slate-800">
                {qbo?.companyName ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Company ID</dt>
              <dd className="font-medium text-slate-800">
                {qbo?.companyId ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Health</dt>
              <dd>{qbo?.health ?? "Offline"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Last Sync</dt>
              <dd>{formatWhen(qbo?.lastSyncAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Next Sync</dt>
              <dd>{formatWhen(qbo?.nextScheduledSyncAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Schedule</dt>
              <dd>
                <select
                  className="mt-0.5 rounded border border-slate-300 bg-white px-2 py-1"
                  disabled={pending || !qbo || qbo.status !== "Connected"}
                  value={qbo?.scheduleFrequency ?? "Manual"}
                  onChange={(e) =>
                    void setQboSchedule(e.target.value as ScheduleFrequency)
                  }
                >
                  {QBO_SCHEDULES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </dd>
            </div>
          </dl>

          {qbo?.lastError ? (
            <p className="mt-3 text-xs text-rose-700">{qbo.lastError}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {(!qbo ||
              qbo.status === "Not Installed" ||
              qbo.status === "Disconnected" ||
              qbo.status === "Installed") && (
              <button
                type="button"
                disabled={pending}
                onClick={() => void connectQbo()}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Connect
              </button>
            )}
            {qbo?.status === "Connected" || qbo?.status === "Syncing" ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void syncQbo()}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Initial Sync / Sync Now
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void reconnectQbo()}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                >
                  Reconnect
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void disconnectQbo()}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                >
                  Disconnect
                </button>
              </>
            ) : null}
            {qbo?.status === "Error" ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void syncQbo()}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Retry Sync
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void reconnectQbo()}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  Reconnect
                </button>
              </>
            ) : null}
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Imports: Profit & Loss, Balance Sheet, Cash Flow Statement, Trial
            Balance, Chart of Accounts → Evidence Catalog™ via Processing
            Pipeline™.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Google Workspace Connector™
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Authenticate, sync Drive document metadata into the Evidence Pipeline™,
          and mirror Calendar / Gmail / Contacts as Knowledge Graph placeholders.
          No content download, parsing, or AI.
        </p>

        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Google Workspace
              </h3>
              <p className="text-xs text-slate-500">
                Productivity · OAuth 2.0 · v1.0.0
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                gws?.status === "Connected"
                  ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                  : gws?.status === "Error"
                    ? "bg-rose-50 text-rose-900 ring-rose-200"
                    : "bg-slate-100 text-slate-700 ring-slate-200"
              }`}
            >
              {gws?.status === "Connected"
                ? "Connected"
                : (gws?.status ?? "Not Connected")}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-slate-600 md:grid-cols-3">
            <div>
              <dt className="text-slate-400">User</dt>
              <dd className="font-medium text-slate-800">
                {gws?.companyName ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Domain</dt>
              <dd className="font-medium text-slate-800">
                {gws?.companyId ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Health</dt>
              <dd>{gws?.health ?? "Offline"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Last Sync</dt>
              <dd>{formatWhen(gws?.lastSyncAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Next Sync</dt>
              <dd>{formatWhen(gws?.nextScheduledSyncAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Schedule</dt>
              <dd>
                <select
                  className="mt-0.5 rounded border border-slate-300 bg-white px-2 py-1"
                  disabled={pending || !gws || gws.status !== "Connected"}
                  value={gws?.scheduleFrequency ?? "Manual"}
                  onChange={(e) =>
                    void setGwsSchedule(e.target.value as ScheduleFrequency)
                  }
                >
                  {GWS_SCHEDULES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </dd>
            </div>
            <div className="col-span-2 md:col-span-3">
              <dt className="text-slate-400">Services Enabled</dt>
              <dd className="font-medium text-slate-800">
                {GWS_SERVICES.join(" · ")}
              </dd>
            </div>
          </dl>

          {gws?.lastError ? (
            <p className="mt-3 text-xs text-rose-700">{gws.lastError}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {(!gws ||
              gws.status === "Not Installed" ||
              gws.status === "Disconnected" ||
              gws.status === "Installed") && (
              <button
                type="button"
                disabled={pending}
                onClick={() => void connectGws(true)}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Connect
              </button>
            )}
            {gws?.status === "Connected" || gws?.status === "Syncing" ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void syncGws()}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Sync Now
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void connectGws(true)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                >
                  Reconnect
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void disconnectGws()}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                >
                  Disconnect
                </button>
              </>
            ) : null}
            {gws?.status === "Error" ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void syncGws()}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Retry Sync
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void connectGws(true)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  Reconnect
                </button>
              </>
            ) : null}
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Drive PDFs / DOCX / Sheets / Slides → Evidence Catalog™. Calendar,
            Gmail headers, and Contacts → Knowledge Graph placeholders only.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Sync History
        </h2>
        {syncJobs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No sync runs yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {syncJobs.map((job) => {
              const events = syncEventsByJobId[job.id] ?? [];
              return (
                <li
                  key={job.id}
                  className="rounded-lg border border-slate-100 px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">
                        {job.connectorId} · {job.status} ·{" "}
                        {formatWhen(job.startedAt)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Duration:{" "}
                        {job.durationMs != null ? `${job.durationMs}ms` : "—"} ·
                        Records: {job.recordsImported} · Failures:{" "}
                        {job.failureCount}
                      </p>
                    </div>
                    {job.status === "Failed" ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          void (job.connectorId === GWS_CONNECTOR_ID
                            ? syncGws()
                            : syncQbo(job.id))
                        }
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium disabled:opacity-50"
                      >
                        Retry
                      </button>
                    ) : null}
                  </div>
                  <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                    {events.map((e) => (
                      <li key={e.id}>
                        <span className="font-medium">{e.eventName}</span>
                        {e.message ? ` — ${e.message}` : ""}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Installed Connectors
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {catalogFlat.map((def) => {
            const install = installationByConnector.get(def.id);
            const isLive =
              def.id === QBO_CONNECTOR_ID || def.id === GWS_CONNECTOR_ID;
            return (
              <article
                key={def.id}
                className="rounded-lg border border-slate-100 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {def.displayName}
                    </h3>
                    <p className="text-xs text-slate-500">{def.category}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                    {isLive
                      ? (install?.status ?? "Available")
                      : "Coming Soon"}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                  <div>
                    <dt className="text-slate-400">Status</dt>
                    <dd>{install?.status ?? "Not Installed"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Version</dt>
                    <dd>{def.version}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Authentication</dt>
                    <dd>{def.authenticationType}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Health</dt>
                    <dd>{install?.health ?? "Offline"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Last Sync</dt>
                    <dd>{formatWhen(install?.lastSyncAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Next Scheduled Sync</dt>
                    <dd>{formatWhen(install?.nextScheduledSyncAt)}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Connector Catalog
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Future integrations grouped by category.
        </p>
        <div className="mt-4 space-y-6">
          {Object.entries(catalogGrouped).map(([category, connectors]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-slate-800">
                {category}
              </h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {connectors.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
                  >
                    <span className="text-slate-800">{c.displayName}</span>
                    <span className="text-xs font-medium text-slate-500">
                      {c.availability === "available"
                        ? "Available"
                        : "Available Soon"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
