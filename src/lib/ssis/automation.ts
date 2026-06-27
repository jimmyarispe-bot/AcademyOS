import type { createAuthClient } from "@/lib/supabase/server-auth";
import { writePlatformAudit } from "@/lib/platform/automation/audit";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";
import { dispatchAdmissionsAutomation } from "@/lib/admissions/automation/dispatch";
import type { WorkflowTriggerEvent } from "@/lib/admissions/automation/types";
import type { LifecycleStage } from "@/lib/ssis/transitions";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

const LIFECYCLE_TO_ADMISSIONS_TRIGGER: Partial<Record<LifecycleStage, WorkflowTriggerEvent>> = {
  accepted: "accepted",
  enrolled: "enrollment_completed",
};

const LIFECYCLE_MISSION_CONTROL: Partial<
  Record<LifecycleStage, { title: string; role: string; severity: "normal" | "high" }>
> = {
  enrolled: {
    title: "New enrollment — schedule and onboarding",
    role: "REGISTRAR",
    severity: "normal",
  },
  graduating: {
    title: "Graduation planning required",
    role: "SCHOOL_LEADER",
    severity: "high",
  },
  withdrawn: {
    title: "Student withdrawal — exit checklist",
    role: "REGISTRAR",
    severity: "high",
  },
};

export async function dispatchSsissLifecycleAutomation(
  supabase: AuthClient,
  input: {
    studentId: string;
    schoolId: string;
    fromStage: LifecycleStage;
    toStage: LifecycleStage;
    admissionsLeadId?: string | null;
    admissionsApplicationId?: string | null;
    triggeredBy?: string | null;
    notes?: string;
  }
) {
  await writePlatformAudit(supabase, {
    schoolId: input.schoolId,
    module: "sis",
    entityType: "student",
    entityId: input.studentId,
    actionType: "lifecycle_transition",
    summary: `Lifecycle ${input.fromStage} → ${input.toStage}`,
    actorUserId: input.triggeredBy,
    metadata: { fromStage: input.fromStage, toStage: input.toStage, notes: input.notes },
  });

  const mc = LIFECYCLE_MISSION_CONTROL[input.toStage];
  if (mc) {
    await createMissionControlItem(supabase, {
      schoolId: input.schoolId,
      module: "sis",
      itemType: "pending_task",
      title: mc.title,
      body: input.notes ?? `Student transitioned to ${input.toStage}`,
      entityType: "student",
      entityId: input.studentId,
      href: `/dashboard/students/${input.studentId}`,
      assignedRole: mc.role,
      severity: mc.severity,
    });
  }

  const admissionsTrigger = LIFECYCLE_TO_ADMISSIONS_TRIGGER[input.toStage];
  if (admissionsTrigger && input.admissionsLeadId) {
    await dispatchAdmissionsAutomation(supabase, {
      leadId: input.admissionsLeadId,
      applicationId: input.admissionsApplicationId ?? undefined,
      trigger: admissionsTrigger,
      sentBy: input.triggeredBy ?? null,
      skipLegacyFallback: false,
    });
  }
}
