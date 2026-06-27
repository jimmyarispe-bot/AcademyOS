import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { getCommandCenterMetrics, getExecutiveInsights } from "@/lib/executive/command-center";
import { generateExecutiveInsights } from "@/lib/executive/insights";
import { getExecutiveDeadlineAnalytics } from "@/lib/compliance/deadlines";
import { CommandCenterDashboard } from "@/components/executive/CommandCenterDashboard";
import { getExecutiveFinancialDashboard } from "@/lib/financial-intelligence/executive";

export default async function ExecutiveCommandCenterPage() {
  const ctx = await getIdentityContext();
  const schoolId =
    ctx?.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx?.accessibleSchoolIds[0];

  const supabase = await createAuthClient();
  await generateExecutiveInsights(supabase, schoolId);

  const [metrics, insights, deadlineAnalytics, fiDashboard] = await Promise.all([
    getCommandCenterMetrics(supabase, schoolId),
    getExecutiveInsights(supabase, schoolId),
    getExecutiveDeadlineAnalytics(supabase, schoolId),
    schoolId ? getExecutiveFinancialDashboard(supabase, schoolId) : null,
  ]);

  return (
    <CommandCenterDashboard
      metrics={metrics}
      insights={insights}
      deadlineAnalytics={deadlineAnalytics}
      fiDashboard={fiDashboard}
    />
  );
}
