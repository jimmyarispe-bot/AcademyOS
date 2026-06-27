import { getIdentityContext } from "@/lib/platform/identity/context";
import { BoardReportingPanel } from "@/components/executive/ExecutivePanels";

export default async function ExecutiveBoardPage() {
  const ctx = await getIdentityContext();
  const schoolId =
    ctx?.orgAssignments.find((a) => a.is_primary)?.school_id ||
    ctx?.accessibleSchoolIds[0] ||
    "";

  return <BoardReportingPanel schoolId={schoolId} />;
}
