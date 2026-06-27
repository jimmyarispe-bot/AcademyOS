export { registerComplianceObligation, computeNextDueDate, completeObligationAndScheduleNext } from "@/lib/compliance/registry";
export { syncComplianceToMissionControl, syncModuleDeadlinesToCompliance } from "@/lib/compliance/automation";
export { syncUniversalDeadlines } from "@/lib/compliance/sync-deadlines";
export {
  getParentDeadlines,
  getStudentDeadlines,
  getTeacherDocumentationDeadlines,
  getExecutiveDeadlineAnalytics,
  mapObligationsToPortalTasks,
} from "@/lib/compliance/deadlines";
export { completePortalObligationAction } from "@/lib/compliance/deadline-actions";
