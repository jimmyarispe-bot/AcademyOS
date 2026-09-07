export const COMMUNICATION_CHANNELS = [
  "email",
  "sms",
  "portal_notification",
  "internal_note",
  /**
   * Email addressed to the school's admissions contact rather than the family.
   *
   * A channel of its own because the delivery path sends every `email` to the
   * guardian — a staff template on that channel would be cheerfully mailed to
   * the parent. `internal_note` was not an option either: it records a message
   * and never sends one.
   */
  "staff_email",
] as const;

export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];

export const COMMUNICATION_TRIGGER_EVENTS = [
  "inquiry_submitted",
  "tour_scheduled",
  "tour_reminder_24h",
  "tour_reminder_2h",
  "application_started",
  "application_incomplete_3d",
  "application_incomplete_7d",
  "application_incomplete_14d",
  "missing_documents",
  "state_funding_verification_needed",
  "funding_verification_approved",
  "funding_verification_rejected",
  "financial_aid_documents_requested",
  "application_submitted",
  "interview_scheduled",
  "interview_reminder_24h",
  "interview_reminder_2h",
  "additional_info_requested",
  // Decision gates (247). A gate asks a school leader a question; these are the
  // branches it can send.
  "decision_gate_opened",
  "application_invited",
  "application_not_invited",
  "shadow_days_invited",
  "shadow_days_not_invited",
  "student_accepted",
  "student_waitlisted",
  "student_declined",
  "enrollment_completed",
  "staff_new_inquiry",
  "staff_application_started",
  "staff_documents_uploaded",
  "staff_funding_verified",
  "staff_financial_aid_submitted",
  "staff_interview_scheduled",
  "staff_application_submitted",
  "staff_application_accepted",
  "staff_portal_message",
] as const;

export type CommunicationTriggerEvent = (typeof COMMUNICATION_TRIGGER_EVENTS)[number];

export const MERGE_FIELDS = [
  "student_name",
  "parent_name",
  "parent_email",
  "parent_phone",
  /**
   * First names, plus guardian_* aliases for the parent_* fields.
   *
   * Added 7 Sept. Migration 294 seeded four live parent-reminder templates
   * written against these names BEFORE they existed. `renderTemplate` leaves an
   * unknown token in place as literal text, so three families were two days
   * from receiving "Hi {{guardian_first_name}},". The templates were disabled;
   * these are the fields they were always meant to use.
   *
   * Separate from parent_name because a greeting wants a first name — "Hi
   * Sarah," not "Hi Sarah Whitfield,".
   */
  "guardian_first_name",
  "student_first_name",
  "guardian_name",
  "guardian_email",
  "guardian_phone",
  "school_name",
  "program_name",
  "campus_name",
  "campus_address",
  "parking_info",
  "funding_program",
  "funding_source",
  "portal_link",
  "application_link",
  "upload_link",
  /**
   * Where a family finishes enrolling. Today that is the same apply portal as
   * application_link — the enrollment packet lives there — but it is named
   * separately because "finish your application" and "finish your enrollment"
   * are different moments, and if they ever get different destinations the
   * templates should not have to change.
   */
  "enrollment_link",
  /** The school's own Google appointment-schedule URL. */
  "scheduling_link",
  /** Shadow-days booking link. Separate calendar from tours -- see migration 247. */
  "shadow_days_link",
  /** Deep link to the pending-decisions page, for the staff gate notification. */
  "decisions_link",
  "admissions_contact_name",
  "admissions_contact_email",
  /** Straight to the lead in the dashboard — for staff mail only. */
  "lead_link",
  "tour_datetime",
  "interview_datetime",
  "missing_items",
  "missing_documents",
  "uploaded_documents",
  "award_amount",
  "award_id",
  "state_student_id",
  "rejection_reason",
  "next_steps",
  "requested_items",
  "deadline",
  "decision_timeframe",
  "tuition_info",
  "orientation_info",
  "technology_info",
  "waitlist_timeline",
  "student_schedule",
  "teacher_assignment",
  "first_day_info",
  "handbook_link",
] as const;

export type MergeField = (typeof MERGE_FIELDS)[number];

export const TRIGGER_EVENT_LABELS: Record<CommunicationTriggerEvent, string> = {
  inquiry_submitted: "Inquiry Submitted",
  decision_gate_opened: "Decision Waiting (staff)",
  application_invited: "Invited to Apply",
  application_not_invited: "Inquiry Closed With Thanks",
  shadow_days_invited: "Invited to Shadow Days",
  shadow_days_not_invited: "Application Declined",
  tour_scheduled: "Tour Scheduled",
  tour_reminder_24h: "Tour Reminder (24h)",
  tour_reminder_2h: "Tour Reminder (2h)",
  application_started: "Application Started",
  application_incomplete_3d: "Application Incomplete (3 days)",
  application_incomplete_7d: "Application Incomplete (7 days)",
  application_incomplete_14d: "Application Incomplete (14 days)",
  missing_documents: "Missing Documents",
  state_funding_verification_needed: "State Funding Verification Needed",
  funding_verification_approved: "Funding Verification Approved",
  funding_verification_rejected: "Funding Verification Rejected",
  financial_aid_documents_requested: "Financial Aid Documents Requested",
  application_submitted: "Application Submitted",
  interview_scheduled: "Interview Scheduled",
  interview_reminder_24h: "Interview Reminder (24h)",
  interview_reminder_2h: "Interview Reminder (2h)",
  additional_info_requested: "Additional Information Requested",
  student_accepted: "Student Accepted",
  student_waitlisted: "Student Waitlisted",
  student_declined: "Student Declined",
  enrollment_completed: "Enrollment Completed",
  staff_new_inquiry: "Staff: New Inquiry",
  staff_application_started: "Staff: Application Started",
  staff_documents_uploaded: "Staff: Documents Uploaded",
  staff_funding_verified: "Staff: Funding Verified",
  staff_financial_aid_submitted: "Staff: Financial Aid Submitted",
  staff_interview_scheduled: "Staff: Interview Scheduled",
  staff_application_submitted: "Staff: Application Submitted",
  staff_application_accepted: "Staff: Application Accepted",
  staff_portal_message: "Staff: Portal Message",
};

export const CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  email: "Email",
  sms: "SMS",
  portal_notification: "Portal Notification",
  internal_note: "Internal Note",
  staff_email: "Email to school leader",
};

export const DECISION_TO_TRIGGER: Record<string, CommunicationTriggerEvent> = {
  accept: "student_accepted",
  waitlist: "student_waitlisted",
  deny: "student_declined",
  request_info: "additional_info_requested",
};

export interface CommunicationTemplate {
  id: string;
  school_id: string | null;
  template_key: string;
  name: string;
  channel: CommunicationChannel;
  trigger_event: CommunicationTriggerEvent;
  subject: string;
  body: string;
  delay_hours: number;
  is_active: boolean;
  category?: string;
  version_number?: number;
  description?: string | null;
}

export interface CommunicationRecord {
  id: string;
  lead_id: string;
  application_id: string | null;
  communication_type: string;
  subject: string;
  body: string;
  sent_to: string;
  sent_by: string | null;
  sent_at: string;
  template_id: string | null;
  template_key: string | null;
  trigger_event: string | null;
  delivery_status: string;
  open_status: string;
  opened_at: string | null;
  is_staff_notification: boolean;
  users?: { full_name: string | null } | null;
}

export interface QueuedCommunication {
  id: string;
  lead_id: string;
  application_id: string | null;
  template_key: string;
  trigger_event: string;
  channel: string;
  scheduled_for: string;
  status: string;
  custom_subject: string | null;
  custom_body: string | null;
}
