import { createStageAutomatedTasks } from "@/lib/admissions/workflow";
import { recordActivity } from "@/lib/platform/activity";
import { resolveSchoolContext } from "@/lib/platform/shared/context";
import type { createAuthClient } from "@/lib/supabase/server-auth";
import type {
  ImportCommitHelpers,
  ImportDestination,
  ImportRowCommitResult,
  PreviewRow,
} from "../../types";
import { normalizeGrade } from "../student/validate";
import { resolveLeadStatus } from "./stage-mapping";
import { normalizeProgram } from "./validate";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

function asClient(helpers: ImportCommitHelpers): AuthClient {
  return helpers.supabase as AuthClient;
}

function text(mapped: Record<string, unknown>, key: string): string {
  const v = mapped[key];
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function isoDate(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

/**
 * Build the lead's notes, preserving everything the target schema has nowhere
 * else to put: the original status wording, the specific academy/campus, the
 * 1st-vs-2nd request attempt, and the legacy record id for traceability.
 */
function buildNotes(mapped: Record<string, unknown>, attempt?: number): string | null {
  const parts: string[] = [];
  const sourceNotes = text(mapped, "notes");
  if (sourceNotes) parts.push(sourceNotes);

  const provenance: string[] = [];
  const status = text(mapped, "lead_status");
  if (status) provenance.push(`Imported status: ${status}`);
  if (attempt && attempt > 1) provenance.push(`Contact attempts: ${attempt}`);
  const academy = text(mapped, "program");
  if (academy) provenance.push(`Academy: ${academy}`);
  const assigned = text(mapped, "assigned_to");
  if (assigned) provenance.push(`Previously assigned: ${assigned}`);
  const sourceId = text(mapped, "source_record_id");
  if (sourceId) provenance.push(`Legacy record: ${sourceId}`);

  if (provenance.length) parts.push(provenance.join(" · "));
  return parts.length ? parts.join("\n\n") : null;
}

/** Existing lead with the same student name and parent email — makes re-runs safe. */
/**
 * Match an incoming row to an existing lead.
 *
 * Two passes, because legacy CRM exports duplicate the same child in ways a
 * name comparison cannot see. The Academy Way's migration contained one record
 * as "La'Marrieon Williams" and another as "Williams La'Marrieon" — same date of
 * birth, same guardian, same phone, one day apart — and a name-only match
 * imported the child twice.
 *
 * 1. Name + guardian email, as before.
 * 2. Date of birth + guardian email, which survives reversed, misspelled or
 *    differently-punctuated names.
 * 3. Name + date of birth, and date of birth + guardian phone, for the case
 *    where two parents inquire
 *    separately about the same child from different email addresses — the
 *    Clubb family filed four inquiries, one of them under the father's email.
 *
 * Passes 2 and 3 only run when both of their fields are present, so sparse
 * records cannot collapse into each other. Siblings share a guardian but not a
 * date of birth, so they stay distinct.
 */
async function findExistingLead(
  supabase: AuthClient,
  schoolId: string,
  firstName: string,
  lastName: string,
  guardianEmail: string,
  dateOfBirth?: string | null,
  guardianPhone?: string | null
): Promise<string | null> {
  let byName = supabase
    .from("admissions_leads")
    .select("id")
    .eq("school_id", schoolId)
    .ilike("first_name", firstName)
    .ilike("last_name", lastName);

  if (guardianEmail) byName = byName.ilike("guardian_email", guardianEmail);

  const { data: nameMatch } = await byName.limit(1).maybeSingle();
  if (nameMatch?.id) return nameMatch.id;

  if (!dateOfBirth) return null;

  // Same name and date of birth in the same school, but a different guardian
  // contact: two parents inquiring separately. Siblings and twins are still
  // distinct here because their first names differ.
  const { data: nameDobMatch } = await supabase
    .from("admissions_leads")
    .select("id")
    .eq("school_id", schoolId)
    .eq("date_of_birth", dateOfBirth)
    .ilike("first_name", firstName)
    .ilike("last_name", lastName)
    .limit(1)
    .maybeSingle();
  if (nameDobMatch?.id) return nameDobMatch.id;

  if (guardianEmail) {
    const { data: byEmail } = await supabase
      .from("admissions_leads")
      .select("id")
      .eq("school_id", schoolId)
      .eq("date_of_birth", dateOfBirth)
      .ilike("guardian_email", guardianEmail)
      .limit(1)
      .maybeSingle();
    if (byEmail?.id) return byEmail.id;
  }

  const phone = digitsOnly(guardianPhone);
  if (!phone) return null;

  const { data: candidates } = await supabase
    .from("admissions_leads")
    .select("id, guardian_phone")
    .eq("school_id", schoolId)
    .eq("date_of_birth", dateOfBirth);

  const byPhone = (candidates ?? []).find((c) => digitsOnly(c.guardian_phone) === phone);
  return byPhone?.id ?? null;
}

/** Phone numbers arrive as "(979) 451-8189", "979-451-8189", "9794518189". */
function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export async function commitLeadRow(
  mapped: Record<string, unknown>,
  destination: ImportDestination,
  action: PreviewRow["action"],
  targetEntityId: string | null | undefined,
  helpers: ImportCommitHelpers
): Promise<ImportRowCommitResult> {
  const supabase = asClient(helpers);
  const related: NonNullable<ImportRowCommitResult["relatedEntities"]> = [];

  if (action === "skip" || action === "ask") {
    return { ok: true, action: "skipped" };
  }

  try {
    const firstName = text(mapped, "first_name");
    const lastName = text(mapped, "last_name");
    const guardianEmail = text(mapped, "guardian_email").toLowerCase();

    const status = resolveLeadStatus(text(mapped, "lead_status"));
    if (!status) {
      return {
        ok: false,
        action: "failed",
        error: `Unrecognized status "${text(mapped, "lead_status")}"`,
      };
    }
    if (status.isStudentRecord) {
      return { ok: true, action: "skipped" };
    }

    const existingId =
      targetEntityId ||
      (await findExistingLead(
        supabase,
        destination.schoolId,
        firstName,
        lastName,
        guardianEmail,
        isoDate(text(mapped, "date_of_birth")),
        text(mapped, "guardian_phone")
      ));

    if (existingId && destination.importMode === "skip_duplicates") {
      return { ok: true, action: "skipped" };
    }

    const inquiryDate = isoDate(text(mapped, "inquiry_date"));
    const payload = {
      school_id: destination.schoolId,
      first_name: firstName,
      last_name: lastName,
      preferred_name: text(mapped, "preferred_name") || null,
      date_of_birth: isoDate(text(mapped, "date_of_birth")),
      current_grade: normalizeGrade(text(mapped, "current_grade")),
      applying_for_grade: normalizeGrade(text(mapped, "applying_for_grade")),
      program: normalizeProgram(text(mapped, "program")),
      referral_source: text(mapped, "referral_source") || null,
      guardian_first_name: text(mapped, "guardian_first_name") || null,
      guardian_last_name: text(mapped, "guardian_last_name") || null,
      guardian_email: guardianEmail || null,
      guardian_phone: text(mapped, "guardian_phone") || null,
      lead_stage: status.leadStage,
      notes: buildNotes(mapped, status.attempt),
      ...(inquiryDate ? { inquiry_date: inquiryDate } : {}),
    };

    let leadId: string;
    let resultAction: "imported" | "updated";

    if (existingId) {
      const { error } = await supabase
        .from("admissions_leads")
        .update(payload)
        .eq("id", existingId);
      if (error) return { ok: false, action: "failed", error: error.message };
      leadId = existingId;
      resultAction = "updated";
    } else {
      const { data, error } = await supabase
        .from("admissions_leads")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) {
        return { ok: false, action: "failed", error: error?.message ?? "Insert returned no lead" };
      }
      leadId = data.id;
      resultAction = "imported";
    }

    // Staff to-do implied by the source status — the reason these aren't stages.
    if (status.pendingTask && resultAction === "imported") {
      const { data: task } = await supabase
        .from("admissions_tasks")
        .insert({
          lead_id: leadId,
          task_name: status.pendingTask,
          task_status: "open",
          due_date: null,
        })
        .select("id")
        .single();
      if (task?.id) {
        related.push({ entityType: "admissions_task", entityId: task.id, action: "created" });
      }
    } else if (resultAction === "imported") {
      // A status that names its own task gets that one. Every other status
      // falls back to the stage's standard follow-up — the same task
      // transitionLeadStage creates when a person moves a lead by hand.
      //
      // WHY THIS EXISTS. Until 2026-09-09 the importer created a task ONLY when
      // LEAD_STATUS_MAP named a pendingTask, and neither status that maps to
      // information_sent names one: "1st request interest meeting/call" and
      // "2nd request - schedule interest meeting/call" set a stage and stop.
      // Those are the "we asked and heard nothing" states — the ones that most
      // need chasing.
      //
      // The result was 113 families parked at information_sent with ZERO open
      // tasks between them, the oldest waiting 216 days. Not one of them had a
      // stage-history row, because a lead written by import never passes
      // through transitionLeadStage. Backfilled by migration 316; this stops it
      // recurring.
      const stageTask = await createStageAutomatedTasks(supabase, leadId, status.leadStage);
      if (stageTask.error) {
        console.error("[lead import] lead created but its stage task was not", {
          leadId,
          stage: status.leadStage,
          error: stageTask.error,
        });
      }
    }

    const schoolCtx = await resolveSchoolContext(supabase, destination.schoolId);
    await recordActivity(supabase, {
      eventType: "admissions.inquiry_created",
      moduleKey: "admissions",
      entityType: "admissions_lead",
      entityId: leadId,
      title: resultAction === "imported" ? "Lead imported" : "Lead updated by import",
      summary: `${firstName} ${lastName}`,
      organizationId: schoolCtx?.organizationId,
      schoolId: destination.schoolId,
      actorUserId: helpers.actorUserId,
      payload: {
        lead_stage: status.leadStage,
        source_status: text(mapped, "lead_status"),
        import_job_id: helpers.jobId,
      },
    });

    return {
      ok: true,
      action: resultAction,
      entityType: "admissions_lead",
      entityId: leadId,
      relatedEntities: related,
    };
  } catch (err) {
    return {
      ok: false,
      action: "failed",
      error: err instanceof Error ? err.message : "Lead import failed",
    };
  }
}
