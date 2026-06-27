import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { getForecastingCenter } from "@/lib/executive/forecasting";
import { getSchools } from "@/lib/hr/queries";
import { ForecastingPanel } from "@/components/executive/ExecutivePanels";

export default async function ExecutiveForecastingPage() {
  const ctx = await getIdentityContext();
  const schoolId =
    ctx?.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx?.accessibleSchoolIds[0] ||
    "";

  const supabase = await createAuthClient();
  const [forecast, schools] = await Promise.all([
    schoolId ? getForecastingCenter(supabase, schoolId) : Promise.resolve({ baseline: null, scenarios: [] }),
    getSchools(),
  ]);

  return (
    <ForecastingPanel
      baseline={forecast.baseline as Record<string, unknown> | null}
      scenarios={forecast.scenarios}
      schoolId={schoolId}
      schools={schools}
    />
  );
}
