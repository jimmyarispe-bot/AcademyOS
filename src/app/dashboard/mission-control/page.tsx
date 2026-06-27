import { PageHeader } from "@/components/ui/PageHeader";
import { MissionControlView } from "@/components/platform/MissionControlView";
import { getMissionControlDashboard } from "@/lib/platform/automation/queries";
import { processAllPlatformQueues } from "@/lib/platform/automation/process-queues";
import { createAuthClient } from "@/lib/supabase/server-auth";

export default async function MissionControlPage() {
  const supabase = await createAuthClient();
  await processAllPlatformQueues(supabase);

  const data = await getMissionControlDashboard();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Mission Control"
        subtitle="Cross-module operations — tasks, automations, alerts, and escalations"
        backHref="/dashboard"
      />
      <MissionControlView
        feed={data.feed}
        queueMetrics={data.queueMetrics}
        summary={data.summary}
        userRole={data.userRole}
        accessDenied={"accessDenied" in data ? data.accessDenied : false}
      />
    </div>
  );
}
