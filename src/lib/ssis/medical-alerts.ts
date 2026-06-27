import type { createAuthClient } from "@/lib/supabase/server-auth";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";
import { logStudentCommunicationEvent } from "@/lib/ssis/timeline";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function processMedicalDocumentExpiryAlerts(supabase: AuthClient) {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 30);
  const today = new Date().toISOString().split("T")[0];
  const horizonStr = horizon.toISOString().split("T")[0];

  const { data: alerts } = await supabase
    .from("ssis_medical_expiry_alerts")
    .select("*, students(first_name, last_name, school_id), student_documents(file_name, document_type)")
    .eq("is_resolved", false)
    .is("notified_at", null)
    .gte("expires_on", today)
    .lte("expires_on", horizonStr);

  for (const alert of alerts ?? []) {
    const studentRaw = alert.students;
    const student = Array.isArray(studentRaw) ? studentRaw[0] : studentRaw;
    const docRaw = alert.student_documents;
    const doc = Array.isArray(docRaw) ? docRaw[0] : docRaw;
    if (!student) continue;

    await createMissionControlItem(supabase, {
      schoolId: student.school_id,
      module: "sis",
      itemType: "pending_task",
      title: `Medical document expiring: ${student.first_name} ${student.last_name}`,
      body: `${doc?.file_name ?? "Document"} expires ${alert.expires_on}`,
      entityType: "student",
      entityId: alert.student_id,
      href: `/dashboard/students/${alert.student_id}?tab=medical`,
      assignedRole: "REGISTRAR",
      severity: "high",
    });

    await logStudentCommunicationEvent(supabase, {
      studentId: alert.student_id,
      schoolId: student.school_id,
      channel: "system",
      direction: "internal",
      subject: "Medical documentation expiry alert",
      body: `Document expires on ${alert.expires_on}`,
      relatedEntityType: "student_documents",
      relatedEntityId: alert.document_id,
    });

    await supabase
      .from("ssis_medical_expiry_alerts")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", alert.id);
  }
}
