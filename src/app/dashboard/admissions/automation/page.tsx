import { PageHeader } from "@/components/ui/PageHeader";
import { AutomationDashboard } from "@/components/admissions/AutomationDashboard";
import {
  getAutomationDashboardMetrics,
  getPendingWorkflowQueue,
  getRecentExecutions,
} from "@/lib/admissions/automation/queries";
import { RunQueuesButton } from "@/components/admissions/RunQueuesButton";

/**
 * This page used to call processAllPlatformQueues() right here, during render.
 * Every visit ran thirty-odd background jobs; every refresh ran them again. It
 * was invisible while the jobs did nothing — the cron had been authenticating
 * as nobody — but the moment that was fixed, loading a page began sending email
 * to families with no record that it had happened. It also bypassed the API
 * route, which is where runs are logged, so the one trigger a human could reach
 * was the one that never appeared in platform_job_runs.
 *
 * Running the queues is now a deliberate act: RunQueuesButton posts to
 * /api/platform/process-queues, which authorises, runs, and writes the run down.
 */

export default async function AutomationDashboardPage() {
  const [metrics, recentExecutions, pendingQueue] = await Promise.all([
    getAutomationDashboardMetrics(),
    getRecentExecutions(),
    getPendingWorkflowQueue(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Automation Dashboard"
        subtitle="Pending automations, failed runs, reminders, and delivery status"
        backHref="/dashboard/admissions"
      />
      <RunQueuesButton />
      <AutomationDashboard
        metrics={metrics}
        recentExecutions={recentExecutions}
        pendingQueue={pendingQueue}
      />
    </div>
  );
}
