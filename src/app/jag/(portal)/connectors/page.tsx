import { redirect } from "next/navigation";
import { JagConnectorsDashboard } from "@/components/jag-platform/JagConnectorsDashboard";
import {
  getConnectorFramework,
  listAccessibleConnectorOrganizations,
  listGoogleWorkspaceSyncHistory,
  listQuickBooksSyncHistory,
  resolveConnectorOrganization,
} from "@/lib/connectors";
import { JAG_PLATFORM_LOGIN_PATH } from "@/lib/jag-platform/auth";
import { getJagPlatformSession } from "@/lib/jag-platform/server-session";

export default async function JagConnectorsPage({
  searchParams,
}: {
  searchParams: Promise<{
    org?: string;
    qbo?: string;
    gws?: string;
    reason?: string;
    /** The provider's own explanation, when the callback managed to get one. */
    detail?: string;
  }>;
}) {
  const session = await getJagPlatformSession();
  if (!session) {
    redirect(JAG_PLATFORM_LOGIN_PATH);
  }

  const params = await searchParams;
  const org = resolveConnectorOrganization(session, params.org);
  if (!org) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
        No organization is available for Connectors™. Provision an organization
        or sign in with a seeded platform account.
      </div>
    );
  }

  const framework = getConnectorFramework();
  const organizations = listAccessibleConnectorOrganizations(session);
  const qboHistory = listQuickBooksSyncHistory(org.id);
  const gwsHistory = listGoogleWorkspaceSyncHistory(org.id);
  const jobs = [...qboHistory.jobs, ...gwsHistory.jobs].sort((a, b) =>
    (b.startedAt ?? "").localeCompare(a.startedAt ?? "")
  );
  const syncEventsByJobId = {
    ...qboHistory.eventsByJobId,
    ...gwsHistory.eventsByJobId,
  };

  // `reason` names the step that failed; `detail` is the provider's own words.
  // Showing only the step produced "QuickBooks connection failed:
  // token_exchange" -- true, and useless. invalid_client, invalid_grant and a
  // redirect_uri mismatch are three different fixes wearing the same label.
  let flash: string | null = null;
  const detail = params.detail ? ` — ${params.detail}` : "";
  if (params.qbo === "connected") {
    flash = "QuickBooks Online connected successfully.";
  } else if (params.qbo === "error") {
    flash = `QuickBooks connection failed${params.reason ? `: ${params.reason}` : "."}${detail}`;
  } else if (params.gws === "connected") {
    flash = "Google Workspace connected successfully.";
  } else if (params.gws === "error") {
    flash = `Google Workspace connection failed${params.reason ? `: ${params.reason}` : "."}${detail}`;
  }

  return (
    <JagConnectorsDashboard
      organizations={organizations}
      organizationId={org.id}
      organizationName={org.name}
      catalogGrouped={framework.listCatalogGrouped()}
      installations={framework.listInstalled(org.id)}
      metrics={framework.getMetrics(org.id)}
      syncJobs={jobs}
      syncEventsByJobId={syncEventsByJobId}
      flash={flash}
    />
  );
}
