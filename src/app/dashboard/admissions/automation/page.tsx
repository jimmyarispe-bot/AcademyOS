import { PageHeader } from "@/components/ui/PageHeader";
import { AutomationDashboard } from "@/components/admissions/AutomationDashboard";
import {
  getAutomationDashboardMetrics,
  getPendingWorkflowQueue,
  getRecentExecutions,
} from "@/lib/admissions/automation/queries";
import { processAllPlatformQueues } from "@/lib/platform/automation/process-queues";
import { createAuthClient } from "@/lib/supabase/server-auth";

export default async function AutomationDashboardPage() {
  const supabase = await createAuthClient();
  await processAllPlatformQueues(supabase);

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
      <AutomationDashboard
        metrics={metrics}
        recentExecutions={recentExecutions}
        pendingQueue={pendingQueue}
      />
    </div>
  );
}
