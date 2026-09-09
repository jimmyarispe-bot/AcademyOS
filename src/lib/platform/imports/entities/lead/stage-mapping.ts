/**
 * Legacy admissions status → canonical pipeline position.
 *
 * Source: The Academy Way's prior platform (Aug 2026 migration). Their status
 * vocabulary mixes two different things — where the *family* is, and what
 * *staff still owe them*. Stages capture the former; `pendingTask` captures the
 * latter as an open task on the lead, so "Send Application" can never sit in a
 * column for six weeks with nothing surfacing it.
 */

import type { LeadStageValue } from "@/lib/constants/admissions";

export interface LeadStatusMapping {
  /**
   * Value written to `admissions_leads.lead_stage`.
   *
   * Typed as the stage union rather than `string`, so the map below is checked
   * against the real stage list instead of against a comment. Previously this
   * said "Must be a recognized legacy stage" and nothing enforced it — which is
   * also why passing it to createStageAutomatedTasks did not compile.
   */
  readonly leadStage: LeadStageValue;
  /** Staff to-do implied by the source status, created as an open task. */
  readonly pendingTask?: string;
  /** Attempt number where the source encoded "1st/2nd request" as a status. */
  readonly attempt?: number;
  /** True when the row belongs in the student roster, not the admissions board. */
  readonly isStudentRecord?: boolean;
}

export const LEAD_STATUS_MAP: Record<string, LeadStatusMapping> = {
  "inquiry received": { leadStage: "new_inquiry" },

  "1st request interest meeting/call": { leadStage: "information_sent", attempt: 1 },
  "1st request  interest meeting/call": { leadStage: "information_sent", attempt: 1 },
  "2nd request - schedule interest meeting/call": {
    leadStage: "information_sent",
    attempt: 2,
  },

  "interest call scheduled": { leadStage: "interview_scheduled" },
  "interest meeting held": { leadStage: "interest_meeting_held" },

  "schedule tour - 1st request": { leadStage: "tour_requested", attempt: 1 },
  "schedule tour - 2nd request": { leadStage: "tour_requested", attempt: 2 },
  "school tour scheduled": { leadStage: "tour_scheduled" },
  "tour conducted": { leadStage: "tour_completed" },

  "shadow days scheduled": { leadStage: "shadow_day_scheduled" },

  // Staff to-dos — stage reflects the family's real position, task carries the work.
  "send application": {
    leadStage: "interest_meeting_held",
    pendingTask: "Send application to family",
  },
  "send yes acceptance email": {
    leadStage: "accepted",
    pendingTask: "Send acceptance email",
  },
  "send no acceptance email": {
    leadStage: "declined",
    pendingTask: "Send decline email",
  },
  "contract sent": { leadStage: "accepted", pendingTask: "Follow up on sent contract" },
  "contract received": {
    leadStage: "accepted",
    pendingTask: "Countersign and file contract",
  },
  "contract signed": { leadStage: "accepted", pendingTask: "Complete enrollment" },

  "declined to enroll": { leadStage: "declined" },
  "not returning": { leadStage: "not_returning" },

  // Currently enrolled belongs in the student roster, not the admissions board.
  "enrolled currently": { leadStage: "enrolled", isStudentRecord: true },

  /**
   * Former students import as terminal "Not Returning" leads rather than student
   * records. AcademyOS students support only enrolled / pending / waitlisted —
   * there is no inactive or alumni state — so a former student on the roster
   * would read as active. Terminal leads keep the family record and contact
   * history without polluting the roster, and can be promoted later if an alumni
   * status is ever added.
   */
  "former student": { leadStage: "not_returning" },
};

function normalizeStatus(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Resolve a source status string. Returns null when unrecognized. */
export function resolveLeadStatus(
  value: string | null | undefined
): LeadStatusMapping | null {
  if (!value) return null;
  const key = normalizeStatus(value);
  if (!key) return null;
  return LEAD_STATUS_MAP[key] ?? null;
}

/** Every source status this migration knows how to place. */
export const KNOWN_SOURCE_STATUSES = Object.keys(LEAD_STATUS_MAP);
