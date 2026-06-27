import type { createAuthClient } from "@/lib/supabase/server-auth";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";
import { writePlatformAudit } from "@/lib/platform/automation/audit";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export type ConversionSource = "manual" | "decision" | "automation" | "portal";

export interface ConvertAcceptedApplicantInput {
  applicationId: string;
  leadId: string;
  convertedBy?: string | null;
  source?: ConversionSource;
}

export interface ConversionResult {
  success: boolean;
  studentId?: string;
  familyId?: string | null;
  conversionId?: string;
  alreadyExists?: boolean;
  error?: string;
}

const DOCUMENT_TYPE_MAP: Record<string, string> = {
  birth_certificate: "birth_certificate",
  report_card: "testing",
  transcript: "transcript",
  iep: "iep",
  "504": "504",
  evaluation: "evaluations",
  medical: "medical",
  custody: "custody",
  immunization: "medical",
  progress_report: "progress_reports",
};

function mapDocumentType(admissionsType: string): string {
  const key = admissionsType.toLowerCase().replace(/\s+/g, "_");
  return DOCUMENT_TYPE_MAP[key] ?? admissionsType;
}

async function findExistingConversion(
  supabase: AuthClient,
  applicationId: string
): Promise<{ studentId: string; conversionId: string } | null> {
  const { data } = await supabase
    .from("sis_admissions_conversions")
    .select("id, student_id")
    .eq("application_id", applicationId)
    .maybeSingle();

  if (data) {
    return { studentId: data.student_id, conversionId: data.id };
  }

  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("admissions_application_id", applicationId)
    .maybeSingle();

  if (student) {
    return { studentId: student.id, conversionId: "" };
  }

  return null;
}

export async function convertAcceptedApplicantToStudent(
  supabase: AuthClient,
  input: ConvertAcceptedApplicantInput
): Promise<ConversionResult> {
  const { applicationId, leadId, convertedBy = null, source = "decision" } = input;

  const existing = await findExistingConversion(supabase, applicationId);
  if (existing) {
    return {
      success: true,
      studentId: existing.studentId,
      alreadyExists: true,
      conversionId: existing.conversionId || undefined,
    };
  }

  const { data: lead, error: leadError } = await supabase
    .from("admissions_leads")
    .select(
      "id, school_id, first_name, last_name, preferred_name, date_of_birth, current_grade, applying_for_grade, program, guardian_first_name, guardian_last_name, guardian_email, guardian_phone"
    )
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    return { success: false, error: leadError?.message ?? "Lead not found" };
  }

  const { data: application, error: appError } = await supabase
    .from("admissions_applications")
    .select(
      "id, school_year_id, application_status, emergency_contact_name, emergency_contact_phone, learning_needs_summary, previous_school"
    )
    .eq("id", applicationId)
    .single();

  if (appError || !application) {
    return { success: false, error: appError?.message ?? "Application not found" };
  }

  if (application.application_status !== "accepted") {
    return { success: false, error: "Application is not accepted" };
  }

  const { data: studentNumber } = await supabase.rpc("generate_student_number", {
    p_school_id: lead.school_id,
  });

  const gradeLevel = lead.applying_for_grade ?? lead.current_grade;
  const today = new Date().toISOString().split("T")[0];

  const familyName =
    lead.guardian_last_name?.trim() ||
    lead.last_name?.trim() ||
    `${lead.first_name} Family`;

  const { data: family, error: familyError } = await supabase
    .from("families")
    .insert({
      school_id: lead.school_id,
      family_name: familyName,
      billing_email: lead.guardian_email,
      billing_phone: lead.guardian_phone,
      status: "active",
    })
    .select("id")
    .single();

  if (familyError || !family) {
    return { success: false, error: familyError?.message ?? "Failed to create family" };
  }

  const { data: student, error: studentError } = await supabase
    .from("students")
    .insert({
      school_id: lead.school_id,
      family_id: family.id,
      first_name: lead.first_name,
      last_name: lead.last_name,
      preferred_name: lead.preferred_name,
      date_of_birth: lead.date_of_birth,
      grade_level: gradeLevel,
      program: lead.program,
      school_year_id: application.school_year_id,
      enrollment_status: "enrolled",
      enrollment_start_date: today,
      status: "active",
      lifecycle_stage: "accepted",
      student_number: studentNumber as string,
      admissions_lead_id: leadId,
      admissions_application_id: applicationId,
    })
    .select("id")
    .single();

  if (studentError || !student) {
    return { success: false, error: studentError?.message ?? "Failed to create student" };
  }

  await supabase.from("sis_enrollments").upsert(
    {
      student_id: student.id,
      school_year_id: application.school_year_id,
      program: lead.program ?? "academy_virtual",
      enrollment_status: "enrolled",
      enrolled_at: today,
      lead_id: leadId,
    },
    { onConflict: "student_id,school_year_id" }
  );

  if (lead.guardian_first_name || lead.guardian_last_name) {
    await supabase.from("guardians").insert({
      family_id: family.id,
      first_name: lead.guardian_first_name ?? "Guardian",
      last_name: lead.guardian_last_name ?? lead.last_name,
      email: lead.guardian_email,
      phone: lead.guardian_phone,
      relationship_to_student: "parent",
      is_primary: true,
      receives_billing: true,
      receives_communications: true,
      contact_type: "parent",
      is_emergency_contact: true,
    });
  }

  const { data: leadGuardians } = await supabase
    .from("admissions_lead_guardians")
    .select("*")
    .eq("lead_id", leadId);

  for (const lg of leadGuardians ?? []) {
    if (lg.email) {
      const { data: existingGuardian } = await supabase
        .from("guardians")
        .select("id")
        .eq("family_id", family.id)
        .eq("email", lg.email)
        .maybeSingle();
      if (existingGuardian) continue;
    }

    await supabase.from("guardians").insert({
      family_id: family.id,
      first_name: lg.first_name,
      last_name: lg.last_name,
      email: lg.email,
      phone: lg.phone,
      relationship_to_student: lg.relationship_to_student,
      is_primary: lg.primary_guardian ?? false,
      receives_billing: lg.receives_billing ?? false,
      receives_communications: lg.receives_school_communications ?? true,
      contact_type: "guardian",
    });
  }

  if (application.emergency_contact_name) {
    const parts = application.emergency_contact_name.trim().split(/\s+/);
    const firstName = parts[0] ?? "Emergency";
    const lastName = parts.slice(1).join(" ") || "Contact";
    await supabase.from("student_authorized_contacts").insert({
      student_id: student.id,
      contact_type: "emergency",
      first_name: firstName,
      last_name: lastName,
      phone: application.emergency_contact_phone,
      can_pick_up: false,
      receives_communications: true,
    });
  }

  const { data: leadFunding } = await supabase
    .from("admissions_lead_funding_sources")
    .select("funding_source_id")
    .eq("lead_id", leadId);

  if (leadFunding?.length) {
    await supabase.from("student_funding_sources").upsert(
      leadFunding.map((row) => ({
        student_id: student.id,
        funding_source_id: row.funding_source_id,
      })),
      { onConflict: "student_id,funding_source_id" }
    );
  }

  const { data: stateFunding } = await supabase
    .from("state_funding_verifications")
    .select("id, state_student_id")
    .eq("application_id", applicationId);

  const stateIds: { state: string; id: string }[] = [];
  for (const sf of stateFunding ?? []) {
    await supabase
      .from("state_funding_verifications")
      .update({ student_id: student.id, lead_id: leadId })
      .eq("id", sf.id);
    if (sf.state_student_id) {
      stateIds.push({ state: "FL", id: sf.state_student_id });
    }
  }

  if (stateIds.length) {
    await supabase
      .from("students")
      .update({ state_student_ids: stateIds })
      .eq("id", student.id);
  }

  await supabase.from("student_learning_profiles").upsert(
    {
      student_id: student.id,
      support_notes: application.learning_needs_summary,
      iep_status: "none",
    },
    { onConflict: "student_id" }
  );

  if (application.emergency_contact_name || application.emergency_contact_phone) {
    await supabase.from("student_medical_profiles").insert({
      student_id: student.id,
      health_alerts: application.learning_needs_summary
        ? [{ type: "admissions_note", text: application.learning_needs_summary }]
        : [],
      notes: application.previous_school
        ? `Previous school: ${application.previous_school}`
        : null,
    });
  }

  const { data: appDocs } = await supabase
    .from("application_documents")
    .select("id, document_type, document_subtype, file_name, storage_path, mime_type, file_size_bytes, uploaded_by")
    .eq("application_id", applicationId)
    .eq("document_status", "approved");

  if (!appDocs?.length) {
    const { data: allDocs } = await supabase
      .from("application_documents")
      .select("id, document_type, document_subtype, file_name, storage_path, mime_type, file_size_bytes, uploaded_by")
      .eq("application_id", applicationId);
    for (const doc of allDocs ?? []) {
      await inheritApplicationDocument(supabase, student.id, doc, convertedBy);
    }
  } else {
    for (const doc of appDocs) {
      await inheritApplicationDocument(supabase, student.id, doc, convertedBy);
    }
  }

  const snapshot = {
    lead_id: leadId,
    application_id: applicationId,
    lead_stage: "accepted",
    application_status: application.application_status,
    converted_at: new Date().toISOString(),
  };

  const { data: conversion, error: conversionError } = await supabase
    .from("sis_admissions_conversions")
    .insert({
      application_id: applicationId,
      lead_id: leadId,
      student_id: student.id,
      family_id: family.id,
      converted_by: convertedBy,
      conversion_source: source,
      snapshot,
    })
    .select("id")
    .single();

  if (conversionError) {
    return { success: false, error: conversionError.message };
  }

  await writePlatformAudit(supabase, {
    schoolId: lead.school_id,
    module: "sis",
    actionType: "admissions_conversion",
    summary: `Converted accepted applicant to student ${studentNumber}`,
    entityType: "student",
    entityId: student.id,
    actorUserId: convertedBy,
    metadata: { applicationId, leadId, conversionId: conversion.id },
  });

  await createMissionControlItem(supabase, {
    schoolId: lead.school_id,
    module: "sis",
    itemType: "overdue_task",
    title: `New student enrolled: ${lead.first_name} ${lead.last_name}`,
    body: `Student #${studentNumber} converted from admissions. Review profile and schedule.`,
    entityType: "student",
    entityId: student.id,
    href: `/dashboard/students/${student.id}`,
    assignedRole: "REGISTRAR",
    severity: "normal",
  });

  const { transitionStudentLifecycle } = await import("@/lib/ssis/transitions");
  await transitionStudentLifecycle(supabase, {
    studentId: student.id,
    toStage: "enrolled",
    triggerSource: source === "portal" || source === "decision" ? "admissions" : source,
    triggeredBy: convertedBy,
    notes: "Converted from accepted admissions application",
    metadata: { applicationId, leadId },
  });

  const { syncStudentFundingRecords } = await import("@/lib/ssis/funding");
  await syncStudentFundingRecords(supabase, student.id, applicationId);

  const { logStudentCommunicationEvent } = await import("@/lib/ssis/timeline");
  await logStudentCommunicationEvent(supabase, {
    studentId: student.id,
    schoolId: lead.school_id,
    channel: "workflow",
    direction: "internal",
    subject: "Student record created from admissions",
    body: `${lead.first_name} ${lead.last_name} enrolled as student #${studentNumber}`,
    actorUserId: convertedBy,
    relatedEntityType: "admissions_applications",
    relatedEntityId: applicationId,
  });

  const { computeStudentSuccessScore } = await import("@/lib/ssis/score");
  await computeStudentSuccessScore(supabase, student.id);

  return {
    success: true,
    studentId: student.id,
    familyId: family.id,
    conversionId: conversion.id,
  };
}

async function inheritApplicationDocument(
  supabase: AuthClient,
  studentId: string,
  doc: {
    id: string;
    document_type: string;
    document_subtype: string | null;
    file_name: string;
    storage_path: string;
    mime_type: string | null;
    file_size_bytes: number | null;
    uploaded_by: string | null;
  },
  convertedBy: string | null
) {
  const { data: existing } = await supabase
    .from("student_documents")
    .select("id")
    .eq("application_document_id", doc.id)
    .maybeSingle();

  if (existing) return;

  await supabase.from("student_documents").insert({
    student_id: studentId,
    document_type: mapDocumentType(doc.document_type),
    document_subtype: doc.document_subtype,
    file_name: doc.file_name,
    storage_path: doc.storage_path,
    mime_type: doc.mime_type,
    file_size_bytes: doc.file_size_bytes,
    uploaded_by: doc.uploaded_by ?? convertedBy,
    source_type: "admissions",
    application_document_id: doc.id,
    inherited_at: new Date().toISOString(),
    status: "active",
  });
}

export async function convertAcceptedApplicantByLead(
  supabase: AuthClient,
  leadId: string,
  convertedBy?: string | null,
  source: ConversionSource = "decision"
): Promise<ConversionResult> {
  const { data: application } = await supabase
    .from("admissions_applications")
    .select("id")
    .eq("lead_id", leadId)
    .eq("application_status", "accepted")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!application) {
    return { success: false, error: "No accepted application found for lead" };
  }

  return convertAcceptedApplicantToStudent(supabase, {
    applicationId: application.id,
    leadId,
    convertedBy,
    source,
  });
}
