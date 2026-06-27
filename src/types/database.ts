/** AcademyOS — mirrors supabase/migrations (Phase 1 + Sprint 1) */

export type EduRoleName =
  | "CEO"
  | "FOUNDER"
  | "EXECUTIVE_DIRECTOR"
  | "REGIONAL_DIRECTOR"
  | "SCHOOL_LEADER"
  | "ADMISSIONS"
  | "FINANCE"
  | "HR"
  | "SCHOLARSHIP_MANAGER"
  | "STATE_FUNDING_MANAGER"
  | "REGISTRAR"
  | "TEACHER"
  | "THERAPIST"
  | "SUPPORT_STAFF"
  | "EMPLOYEE"
  | "PARENT"
  | "STUDENT"
  | "BOARD_MEMBER"
  | "AUDITOR"
  | "GUEST"
  | (string & {});

export type EntityStatus = "active" | "inactive" | "archived";
export type IepStatus = "none" | "pending" | "active" | "expired";
export type DocumentStatus = "active" | "archived" | "deleted";
export type EmployeeType = "teacher" | "contractor" | "staff" | "admin";
export type EmploymentStatus = "active" | "inactive" | "terminated" | "on_leave";
export type AgePreferenceLevel = "preferred" | "acceptable" | "avoid";
export type CourseStatus = "draft" | "active" | "inactive" | "archived";
export type SectionStatus = "draft" | "open" | "closed" | "cancelled" | "completed";
export type EnrollmentStatus =
  | "pending"
  | "enrolled"
  | "waitlisted"
  | "dropped"
  | "completed";
export type SessionStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";
export type SessionType =
  | "instruction"
  | "lab"
  | "tutoring"
  | "assessment"
  | "other";
export type PaymentStatus = "pending" | "approved" | "paid" | "void";

// ---------------------------------------------------------------------------
// Phase 1
// ---------------------------------------------------------------------------

export interface School {
  id: string;
  name: string;
  address: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchoolSettings {
  id: string;
  school_id: string;
  config: Record<string, unknown>;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  display_name?: string | null;
  description?: string | null;
  is_system?: boolean;
  is_custom?: boolean;
  parent_role_id?: string | null;
  sort_order?: number;
}

export interface UserRole {
  user_id: string;
  role_id: string;
}

export interface UserSchool {
  id: string;
  user_id: string;
  school_id: string;
  created_at: string;
}

export interface Student {
  id: string;
  school_id: string;
  campus_id: string | null;
  school_year_id: string | null;
  family_id: string | null;
  user_id: string | null;
  first_name: string;
  last_name: string;
  legal_middle_name: string | null;
  preferred_name: string | null;
  status: string;
  enrollment_status: string;
  grade_level: string | null;
  gender: string | null;
  program: string | null;
  date_of_birth: string | null;
  student_number: string | null;
  state_student_ids: { state: string; id: string }[];
  photo_url: string | null;
  photo_storage_path: string | null;
  enrollment_start_date: string | null;
  enrollment_exit_date: string | null;
  graduation_year: number | null;
  lifecycle_stage: string;
  admissions_lead_id: string | null;
  admissions_application_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentFamilyLink {
  id: string;
  student_id: string;
  user_id: string;
  relationship_type: string | null;
  created_at: string;
}

export interface Class {
  id: string;
  school_id: string;
  teacher_id: string | null;
  subject: string | null;
  created_at: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  class_id: string;
  enrolled_at: string;
}

// ---------------------------------------------------------------------------
// Sprint 1
// ---------------------------------------------------------------------------

export interface Campus {
  id: string;
  school_id: string;
  name: string;
  code: string | null;
  address: string | null;
  timezone: string | null;
  is_primary: boolean;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface SchoolYear {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface StudentLearningProfile {
  id: string;
  student_id: string;
  learning_style: string | null;
  reading_level: string | null;
  math_level: string | null;
  accommodations: Record<string, unknown>;
  iep_status: IepStatus;
  support_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentDocument {
  id: string;
  student_id: string;
  document_type: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  uploaded_by: string | null;
  status: DocumentStatus;
  created_at: string;
  updated_at: string;
}

export interface StudentSchedulePreference {
  id: string;
  student_id: string;
  school_year_id: string | null;
  day_of_week: number;
  preferred_start_time: string | null;
  preferred_end_time: string | null;
  availability_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  school_id: string;
  user_id: string | null;
  employee_number: string | null;
  employee_type: EmployeeType;
  employment_status: EmploymentStatus;
  hire_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeProfile {
  id: string;
  employee_id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  bio: string | null;
  certifications: unknown[];
  specializations: string[] | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeAvailability {
  id: string;
  employee_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  effective_from: string | null;
  effective_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeAgePreference {
  id: string;
  employee_id: string;
  min_age: number;
  max_age: number;
  preference_level: AgePreferenceLevel;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  school_id: string;
  code: string;
  name: string;
  description: string | null;
  subject: string | null;
  grade_levels: string[] | null;
  credit_hours: number | null;
  status: CourseStatus;
  program?: string | null;
  delivery_mode?: string;
  term_type?: string | null;
  academy_subject?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourseSection {
  id: string;
  course_id: string;
  school_year_id: string;
  campus_id: string | null;
  section_code: string;
  instructor_employee_id: string | null;
  max_capacity: number;
  status: SectionStatus;
  meeting_pattern: Record<string, unknown>;
  day_pattern?: string | null;
  start_time_et?: string | null;
  instructional_minutes?: number;
  delivery_mode?: string;
  min_capacity?: number;
  program?: string | null;
  structured_literacy_level?: number | null;
  structured_literacy_step?: number | null;
  academy_level?: number | null;
  term_id?: string | null;
  room_id?: string | null;
  meet_link?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentEnrollment {
  id: string;
  student_id: string;
  course_section_id: string;
  school_year_id: string;
  enrollment_status: EnrollmentStatus;
  enrolled_at: string;
  dropped_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstructionalSession {
  id: string;
  course_section_id: string;
  instructor_employee_id: string;
  campus_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  session_status: SessionStatus;
  session_type: SessionType;
  attendance_notes: string | null;
  room_id?: string | null;
  meet_link?: string | null;
  student_id?: string | null;
  therapy_service_type?: string | null;
  rescheduled_from_id?: string | null;
  cancellation_reason?: string | null;
  generation_run_id?: string | null;
  time_display?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractorPayLedger {
  id: string;
  school_id: string;
  employee_id: string;
  instructional_session_id: string | null;
  pay_period_start: string;
  pay_period_end: string;
  hours_worked: number;
  hourly_rate: number;
  gross_amount: number;
  payment_status: PaymentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdmissionLead {
  id: string;
  school_id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  date_of_birth: string | null;
  current_grade: string | null;
  applying_for_grade: string | null;
  program: string | null;
  referral_source: string | null;
  inquiry_date: string;
  lead_stage: string;
  stage_entered_at: string;
  guardian_first_name: string | null;
  guardian_last_name: string | null;
  guardian_email: string | null;
  guardian_phone: string | null;
  notes: string | null;
  assigned_to_user_id: string | null;
  created_at: string;
  updated_at: string;
}

/** @deprecated Use AdmissionLead — table renamed to admissions_leads */
export type Prospect = AdmissionLead;

export interface ScholarshipApplication {
  id: string;
  application_id: string;
  requested_amount: number | null;
  approved_amount: number | null;
  household_income: number | null;
  scholarship_status: string;
  review_notes: string | null;
  approver_name: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdmissionsApplication {
  id: string;
  lead_id: string;
  school_year_id: string;
  application_date: string;
  application_status: string;
  admissions_decision_date: string | null;
  accepted_by_user_id: string | null;
  previous_school: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  learning_needs_summary: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationDocument {
  id: string;
  application_id: string;
  document_type: string;
  document_subtype: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  document_status: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StateFundingVerification {
  id: string;
  application_id: string;
  funding_source_code: string;
  state_program_id: string | null;
  verification_status: string;
  verified_by_user_id: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScholarshipDocument {
  id: string;
  scholarship_application_id: string;
  document_type: string;
  file_name: string;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  school_id: string;
  title: string;
  department: string | null;
  description: string | null;
  employment_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeCertification {
  id: string;
  employee_id: string;
  certification_name: string;
  issuing_body: string | null;
  certification_number: string | null;
  issued_date: string | null;
  expiration_date: string | null;
  status: string;
  document_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollRecord {
  id: string;
  school_id: string;
  employee_id: string;
  pay_period_start: string;
  pay_period_end: string;
  gross_pay: number;
  deductions: number;
  net_pay: number;
  hours_worked: number | null;
  pay_status: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeePosition {
  id: string;
  employee_id: string;
  position_id: string;
  is_primary: boolean;
  effective_from: string | null;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface FundingSource {
  id: string;
  code: string;
  label: string;
  funding_source_category: string;
  sort_order: number;
}

export interface AdmissionsLeadFundingSource {
  lead_id: string;
  funding_source_id: string;
  created_at: string;
}

export interface StudentFundingSource {
  student_id: string;
  funding_source_id: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Supabase Database map
// ---------------------------------------------------------------------------

type Timestamps = "created_at" | "updated_at";

type Sprint1Row<T extends { id: string } & Partial<Record<Timestamps, string>>> = {
  Row: T;
  Insert: Omit<T, "id" | Timestamps> & {
    id?: string;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<T>;
};

export interface Database {
  public: {
    Tables: {
      schools: {
        Row: School;
        Insert: Omit<School, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<School>;
      };
      school_settings: {
        Row: SchoolSettings;
        Insert: Omit<SchoolSettings, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<SchoolSettings>;
      };
      users: {
        Row: User;
        Insert: Omit<User, "created_at"> & { created_at?: string };
        Update: Partial<User>;
      };
      roles: {
        Row: Role;
        Insert: Omit<Role, "id"> & { id?: string };
        Update: Partial<Role>;
      };
      user_roles: {
        Row: UserRole;
        Insert: UserRole;
        Update: Partial<UserRole>;
      };
      user_schools: {
        Row: UserSchool;
        Insert: Omit<UserSchool, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<UserSchool>;
      };
      students: {
        Row: Student;
        Insert: Omit<Student, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          status?: string;
        };
        Update: Partial<Student>;
      };
      student_family_link: {
        Row: StudentFamilyLink;
        Insert: Omit<StudentFamilyLink, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<StudentFamilyLink>;
      };
      classes: {
        Row: Class;
        Insert: Omit<Class, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Class>;
      };
      enrollments: {
        Row: Enrollment;
        Insert: Omit<Enrollment, "id" | "enrolled_at"> & {
          id?: string;
          enrolled_at?: string;
        };
        Update: Partial<Enrollment>;
      };
      campuses: Sprint1Row<Campus>;
      school_years: Sprint1Row<SchoolYear>;
      student_learning_profiles: Sprint1Row<StudentLearningProfile>;
      student_documents: Sprint1Row<StudentDocument>;
      student_schedule_preferences: Sprint1Row<StudentSchedulePreference>;
      employees: Sprint1Row<Employee>;
      employee_profiles: Sprint1Row<EmployeeProfile>;
      employee_availability: Sprint1Row<EmployeeAvailability>;
      employee_age_preferences: Sprint1Row<EmployeeAgePreference>;
      courses: Sprint1Row<Course>;
      course_sections: Sprint1Row<CourseSection>;
      student_enrollments: Sprint1Row<StudentEnrollment>;
      instructional_sessions: Sprint1Row<InstructionalSession>;
      contractor_pay_ledger: Sprint1Row<ContractorPayLedger>;
      academic_terms: Sprint1Row<{
        id: string;
        school_id: string;
        school_year_id: string;
        name: string;
        term_type: string;
        start_date: string;
        end_date: string;
        is_current: boolean;
        created_at: string;
        updated_at: string;
      }>;
      academic_calendars: Sprint1Row<{
        id: string;
        school_id: string;
        name: string;
        calendar_scope: string;
        campus_id: string | null;
        program: string | null;
        employee_id: string | null;
        student_id: string | null;
        school_year_id: string | null;
        timezone: string;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      academic_calendar_events: Sprint1Row<{
        id: string;
        calendar_id: string;
        event_type: string;
        title: string;
        description: string | null;
        starts_at: string;
        ends_at: string;
        all_day: boolean;
        blocks_scheduling: boolean;
        metadata: Record<string, unknown>;
        created_at: string;
        updated_at: string;
      }>;
      schedule_rooms: Sprint1Row<{
        id: string;
        school_id: string;
        campus_id: string | null;
        name: string;
        room_type: string;
        capacity: number;
        is_virtual: boolean;
        meet_link: string | null;
        equipment: unknown[];
        status: string;
        created_at: string;
        updated_at: string;
      }>;
      section_staff_assignments: Sprint1Row<{
        id: string;
        course_section_id: string;
        employee_id: string;
        assignment_role: string;
        is_active: boolean;
        starts_on: string | null;
        ends_on: string | null;
        created_at: string;
        updated_at: string;
      }>;
      schedule_session_generation_runs: Sprint1Row<{
        id: string;
        school_id: string;
        course_section_id: string | null;
        generated_by: string | null;
        date_from: string;
        date_to: string;
        sessions_created: number;
        sessions_skipped: number;
        status: string;
        error_message: string | null;
        metadata: Record<string, unknown>;
        created_at: string;
      }>;
      session_attendance_records: Sprint1Row<{
        id: string;
        instructional_session_id: string;
        student_id: string;
        attendance_status: string;
        sis_attendance_record_id: string | null;
        recorded_by: string | null;
        recorded_at: string;
        notes: string | null;
      }>;
      schedule_conflicts: Sprint1Row<{
        id: string;
        school_id: string;
        conflict_type: string;
        severity: string;
        entity_type: string;
        entity_id: string;
        related_entity_type: string | null;
        related_entity_id: string | null;
        title: string;
        description: string | null;
        recommendation: string | null;
        is_resolved: boolean;
        resolved_at: string | null;
        detected_at: string;
        metadata: Record<string, unknown>;
      }>;
      schedule_room_bookings: Sprint1Row<{
        id: string;
        room_id: string;
        instructional_session_id: string | null;
        booked_start: string;
        booked_end: string;
        booking_status: string;
        created_at: string;
      }>;
      schedule_academy_way_config: Sprint1Row<{
        id: string;
        school_id: string;
        virtual_start_on_hour: boolean;
        virtual_end_at_minute: number;
        use_12_hour_display: boolean;
        min_reading_size: number;
        min_writing_size: number;
        min_math_size: number;
        min_structured_literacy_size: number;
        tutoring_max_size: number;
        allow_hs_in_virtual: boolean;
        rules: Record<string, unknown>;
        created_at: string;
        updated_at: string;
      }>;
      instructional_session_deliveries: Sprint1Row<{
        id: string;
        instructional_session_id: string;
        lesson_status: string;
        lesson_objectives: unknown[];
        standards: string[];
        learning_targets: unknown[];
        activities: unknown[];
        session_notes: string | null;
        homework: string | null;
        attachment_refs: unknown[];
        started_at: string | null;
        started_by: string | null;
        completed_at: string | null;
        completed_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      instructional_session_student_records: Sprint1Row<{
        id: string;
        instructional_session_id: string;
        student_id: string;
        participation_level: string | null;
        behavior_observation: string | null;
        assessment_result: Record<string, unknown>;
        session_notes: string | null;
        created_at: string;
        updated_at: string;
      }>;
      student_academic_progress_records: Sprint1Row<{
        id: string;
        student_id: string;
        domain: string;
        current_level: number;
        previous_level: number | null;
        growth_summary: string | null;
        assessment_date: string;
        teacher_notes: string | null;
        evidence: unknown[];
        instructional_session_id: string | null;
        recorded_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      structured_literacy_progress: Sprint1Row<{
        id: string;
        student_id: string;
        literacy_level: number;
        literacy_step: number;
        mastery_date: string | null;
        instructional_minutes: number;
        lesson_history: unknown[];
        artifact_refs: unknown[];
        teacher_notes: string | null;
        next_step_recommendation: string | null;
        instructional_session_id: string | null;
        recorded_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      student_learning_artifacts: Sprint1Row<{
        id: string;
        student_id: string;
        instructional_session_id: string | null;
        lesson_plan_id: string | null;
        learning_objective: string | null;
        assessment_id: string | null;
        artifact_type: string;
        title: string;
        description: string | null;
        storage_path: string;
        file_name: string | null;
        mime_type: string | null;
        visible_to_parent: boolean;
        uploaded_by: string | null;
        growth_goal_id: string | null;
        intervention_id: string | null;
        subject_domain: string | null;
        recorded_by_employee_id: string | null;
        metadata: Record<string, unknown>;
        created_at: string;
        updated_at: string;
      }>;
      student_instructional_teams: Sprint1Row<{
        id: string;
        student_id: string;
        school_id: string;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      student_instructional_team_members: Sprint1Row<{
        id: string;
        team_id: string;
        employee_id: string;
        team_role: string;
        is_primary: boolean;
        is_active: boolean;
        starts_on: string | null;
        ends_on: string | null;
        notes: string | null;
        created_at: string;
        updated_at: string;
      }>;
      student_growth_goals: Sprint1Row<{
        id: string;
        student_id: string;
        goal_source: string;
        title: string;
        description: string | null;
        baseline: string | null;
        target: string | null;
        progress_pct: number;
        progress_notes: string | null;
        success_criteria: string | null;
        status: string;
        review_date: string | null;
        assigned_employee_id: string | null;
        source_entity_type: string | null;
        source_entity_id: string | null;
        evidence: unknown[];
        subject_domain: string | null;
        created_at: string;
        updated_at: string;
      }>;
      instructional_session_outcomes: Sprint1Row<{
        id: string;
        instructional_session_id: string;
        student_id: string | null;
        skills_addressed: unknown[];
        learning_objectives: unknown[];
        student_response: string | null;
        mastery_level: string | null;
        evidence_collected: unknown[];
        recommended_next_steps: string | null;
        homework_practice: string | null;
        follow_up_tasks: unknown[];
        growth_goal_id: string | null;
        recorded_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      intervention_effectiveness_records: Sprint1Row<{
        id: string;
        intervention_id: string;
        student_id: string;
        recorded_at: string;
        period_start: string | null;
        period_end: string | null;
        minutes_delivered: number;
        sessions_delivered: number;
        progress_score: number | null;
        progress_trend: string | null;
        effectiveness_rating: string | null;
        outcome_notes: string | null;
        recorded_by: string | null;
        created_at: string;
      }>;
      student_instructional_meetings: Sprint1Row<{
        id: string;
        student_id: string;
        school_id: string;
        meeting_type: string;
        title: string;
        scheduled_at: string | null;
        completed_at: string | null;
        status: string;
        agenda: string | null;
        notes: string | null;
        decisions: string | null;
        follow_up_date: string | null;
        ssis_event_id: string | null;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      student_instructional_meeting_participants: Sprint1Row<{
        id: string;
        meeting_id: string;
        employee_id: string | null;
        participant_name: string | null;
        participant_role: string | null;
        attended: boolean;
        created_at: string;
      }>;
      student_instructional_meeting_tasks: Sprint1Row<{
        id: string;
        meeting_id: string;
        assigned_employee_id: string | null;
        title: string;
        due_date: string | null;
        status: string;
        created_at: string;
        updated_at: string;
      }>;
      student_collaboration_feed_events: Sprint1Row<{
        id: string;
        student_id: string;
        school_id: string;
        actor_employee_id: string | null;
        actor_user_id: string | null;
        event_type: string;
        title: string;
        body: string | null;
        related_entity_type: string | null;
        related_entity_id: string | null;
        classification: string;
        metadata: Record<string, unknown>;
        occurred_at: string;
        created_at: string;
      }>;
      teacher_instructional_notes: Sprint1Row<{
        id: string;
        employee_id: string;
        student_id: string | null;
        instructional_session_id: string | null;
        category: string;
        title: string;
        body: string;
        tags: string[];
        is_private: boolean;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      teacher_lesson_plans: Sprint1Row<{
        id: string;
        employee_id: string;
        school_id: string;
        title: string;
        subject_domain: string | null;
        objectives: unknown[];
        materials: unknown[];
        activities: unknown[];
        assessments: unknown[];
        differentiation: string | null;
        accommodations: string | null;
        homework: string | null;
        artifact_refs: unknown[];
        status: string;
        is_reusable: boolean;
        created_at: string;
        updated_at: string;
      }>;
      teacher_lesson_plan_sections: Sprint1Row<{
        id: string;
        lesson_plan_id: string;
        course_section_id: string;
        created_at: string;
      }>;
      session_assessment_records: Sprint1Row<{
        id: string;
        instructional_session_id: string;
        student_id: string;
        assessment_type: string;
        title: string;
        score: string | null;
        rubric: Record<string, unknown>;
        mastery_level: string | null;
        notes: string | null;
        sis_assessment_id: string | null;
        recorded_by: string | null;
        assessed_at: string;
        created_at: string;
        updated_at: string;
      }>;
      teacher_parent_outreach: Sprint1Row<{
        id: string;
        employee_id: string;
        student_id: string;
        message_type: string;
        subject: string;
        body: string;
        artifact_ids: string[];
        status: string;
        sent_at: string | null;
        ssis_event_id: string | null;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      teacher_ai_readiness_config: Sprint1Row<{
        id: string;
        school_id: string;
        capabilities: Record<string, boolean>;
        integration_hooks: Record<string, unknown>;
        notes: string | null;
        created_at: string;
        updated_at: string;
      }>;
      admissions_leads: {
        Row: AdmissionLead;
        Insert: Omit<AdmissionLead, "id" | "created_at" | "updated_at" | "stage_entered_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          stage_entered_at?: string;
        };
        Update: Partial<AdmissionLead>;
      };
      /** @deprecated Use admissions_leads */
      prospects: Sprint1Row<AdmissionLead>;
      admissions_applications: Sprint1Row<AdmissionsApplication>;
      application_documents: Sprint1Row<ApplicationDocument>;
      state_funding_verifications: Sprint1Row<StateFundingVerification>;
      scholarship_applications: Sprint1Row<ScholarshipApplication>;
      scholarship_documents: Sprint1Row<ScholarshipDocument>;
      positions: Sprint1Row<Position>;
      employee_positions: Sprint1Row<EmployeePosition>;
      employee_certifications: Sprint1Row<EmployeeCertification>;
      payroll_records: Sprint1Row<PayrollRecord>;
      families: Sprint1Row<{
        id: string;
        school_id: string;
        family_name: string;
        primary_address: string | null;
        city: string | null;
        state: string | null;
        zip_code: string | null;
        billing_email: string | null;
        billing_phone: string | null;
        status: string;
        created_at: string;
        updated_at: string;
      }>;
      guardians: Sprint1Row<{
        id: string;
        family_id: string;
        user_id: string | null;
        first_name: string;
        last_name: string;
        relationship_to_student: string | null;
        email: string | null;
        phone: string | null;
        is_primary: boolean;
        receives_billing: boolean;
        receives_communications: boolean;
        created_at: string;
        updated_at: string;
      }>;
      sis_enrollments: Sprint1Row<{
        id: string;
        student_id: string;
        school_year_id: string;
        program: string;
        enrollment_status: string;
        enrolled_at: string | null;
        withdrawn_at: string | null;
        lead_id: string | null;
        created_at: string;
        updated_at: string;
      }>;
      admissions_tours: Sprint1Row<{
        id: string;
        lead_id: string;
        scheduled_at: string;
        duration_minutes: number;
        tour_type: string;
        tour_status: string;
        campus_id: string | null;
        host_user_id: string | null;
        notes: string | null;
        completed_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      admissions_notes: Sprint1Row<{
        id: string;
        lead_id: string;
        created_by: string | null;
        note_text: string;
        created_at: string;
        updated_at: string;
      }>;
      admissions_tasks: Sprint1Row<{
        id: string;
        lead_id: string;
        assigned_to_user_id: string | null;
        task_name: string;
        due_date: string | null;
        task_status: string;
        completed_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      admissions_lead_stage_history: Sprint1Row<{
        id: string;
        lead_id: string;
        previous_stage: string | null;
        new_stage: string;
        changed_by: string | null;
        changed_at: string;
      }>;
      tuition_plans: Sprint1Row<{
        id: string;
        school_id: string;
        name: string;
        description: string | null;
        program: string | null;
        annual_amount: number;
        payment_schedule: string;
        status: string;
        created_at: string;
        updated_at: string;
      }>;
      family_billing_accounts: Sprint1Row<{
        id: string;
        family_id: string;
        school_id: string;
        account_status: string;
        balance: number;
        credit_balance: number;
        collections_status: string;
        autopay_enabled: boolean;
        payment_plan_id: string | null;
        custody_billing_notes: string | null;
        sibling_discount_student_id: string | null;
        sibling_discount_percent: number;
        created_at: string;
        updated_at: string;
      }>;
      invoices: Sprint1Row<{
        id: string;
        billing_account_id: string;
        tuition_plan_id: string | null;
        student_id: string | null;
        invoice_number: string;
        description: string | null;
        subtotal: number;
        sibling_discount_amount: number;
        scholarship_credit: number;
        state_funding_credit: number;
        grant_credit: number;
        discount_amount: number;
        tax_amount: number;
        late_fee_amount: number;
        total_amount: number;
        amount_paid: number;
        family_responsibility: number;
        due_date: string;
        invoice_status: string;
        issued_at: string | null;
        paid_at: string | null;
        payment_plan_id: string | null;
        program: string | null;
        funding_source_code: string | null;
        created_at: string;
        updated_at: string;
      }>;
      payments: Sprint1Row<{
        id: string;
        invoice_id: string;
        amount: number;
        payment_method: string;
        reference_number: string | null;
        paid_at: string;
        recorded_by_user_id: string | null;
        notes: string | null;
        payment_status: string;
        receipt_number: string | null;
        external_processor_ref: string | null;
        failure_reason: string | null;
        created_at: string;
        updated_at: string;
      }>;
      financial_transactions: Sprint1Row<{
        id: string;
        school_id: string;
        source_module: string;
        transaction_type: string;
        category: string;
        amount: number;
        transaction_date: string;
        student_id: string | null;
        family_id: string | null;
        program: string | null;
        funding_source_code: string | null;
        invoice_id: string | null;
        payment_id: string | null;
        scholarship_application_id: string | null;
        entity_type: string | null;
        entity_id: string | null;
        approval_status: string;
        description: string | null;
        metadata: Record<string, unknown>;
        created_by: string | null;
        created_at: string;
      }>;
      budget_forecast_snapshots: Sprint1Row<{
        id: string;
        school_id: string;
        snapshot_name: string;
        period_start: string;
        period_end: string;
        forecast_tuition: number;
        forecast_scholarships: number;
        forecast_state_funding: number;
        forecast_grants: number;
        forecast_payroll: number;
        actual_tuition: number;
        actual_scholarships: number;
        actual_state_funding: number;
        actual_grants: number;
        actual_payroll: number;
        enrollment_count: number;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      funding_sources: {
        Row: FundingSource;
        Insert: Omit<FundingSource, "id"> & { id?: string };
        Update: Partial<FundingSource>;
      };
      admissions_lead_funding_sources: {
        Row: AdmissionsLeadFundingSource;
        Insert: Omit<AdmissionsLeadFundingSource, "created_at"> & { created_at?: string };
        Update: Partial<AdmissionsLeadFundingSource>;
      };
      admissions_communications: Sprint1Row<{
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
        recipient_phone: string | null;
        is_staff_notification: boolean;
        metadata: Record<string, unknown>;
        created_at: string;
        updated_at: string;
      }>;
      admissions_communication_templates: Sprint1Row<{
        id: string;
        school_id: string | null;
        template_key: string;
        name: string;
        channel: string;
        trigger_event: string;
        subject: string;
        body: string;
        delay_hours: number;
        is_active: boolean;
        category: string;
        version_number: number;
        description: string | null;
        created_at: string;
        updated_at: string;
      }>;
      admissions_communication_queue: Sprint1Row<{
        id: string;
        lead_id: string;
        application_id: string | null;
        template_id: string | null;
        template_key: string;
        trigger_event: string;
        channel: string;
        scheduled_for: string;
        status: string;
        custom_subject: string | null;
        custom_body: string | null;
        sent_communication_id: string | null;
        metadata: Record<string, unknown>;
        created_at: string;
        updated_at: string;
      }>;
      admissions_staff_notifications: Sprint1Row<{
        id: string;
        user_id: string | null;
        school_id: string;
        lead_id: string | null;
        application_id: string | null;
        notification_type: string;
        title: string;
        body: string;
        read_at: string | null;
        created_at: string;
      }>;
      admissions_portal_notifications: Sprint1Row<{
        id: string;
        lead_id: string;
        application_id: string | null;
        title: string;
        body: string;
        read_at: string | null;
        created_at: string;
      }>;
      admissions_workflows: Sprint1Row<{
        id: string;
        school_id: string | null;
        workflow_key: string;
        name: string;
        description: string | null;
        trigger_event: string;
        category: string;
        is_active: boolean;
        sort_order: number;
        version_number: number;
        lifecycle_status: string;
        published_at: string | null;
        archived_at: string | null;
        parent_workflow_id: string | null;
        module: string;
        metadata: Record<string, unknown>;
        created_at: string;
        updated_at: string;
      }>;
      admissions_workflow_steps: Sprint1Row<{
        id: string;
        workflow_id: string;
        step_order: number;
        step_type: string;
        action_type: string | null;
        config: Record<string, unknown>;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      admissions_workflow_executions: Sprint1Row<{
        id: string;
        workflow_id: string | null;
        lead_id: string;
        application_id: string | null;
        trigger_event: string;
        status: string;
        started_at: string;
        completed_at: string | null;
        error_message: string | null;
        metadata: Record<string, unknown>;
        created_at: string;
      }>;
      admissions_workflow_queue: Sprint1Row<{
        id: string;
        execution_id: string | null;
        workflow_id: string | null;
        workflow_step_id: string | null;
        lead_id: string;
        application_id: string | null;
        trigger_event: string;
        step_payload: Record<string, unknown>;
        scheduled_for: string;
        status: string;
        retry_count: number;
        max_retries: number;
        last_error: string | null;
        completed_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      admissions_escalation_rules: Sprint1Row<{
        id: string;
        school_id: string | null;
        rule_key: string;
        name: string;
        trigger_event: string;
        after_hours: number;
        condition_config: Record<string, unknown>;
        actions: unknown[];
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      admissions_automation_audit_log: Sprint1Row<{
        id: string;
        school_id: string | null;
        lead_id: string | null;
        application_id: string | null;
        execution_id: string | null;
        actor_user_id: string | null;
        event_type: string;
        event_category: string;
        summary: string;
        details: Record<string, unknown>;
        module: string;
        entity_type: string | null;
        entity_id: string | null;
        before_state: Record<string, unknown> | null;
        after_state: Record<string, unknown> | null;
        ip_address: string | null;
        user_role: string | null;
        created_at: string;
      }>;
      admissions_interviews: Sprint1Row<{
        id: string;
        lead_id: string;
        application_id: string | null;
        scheduled_at: string;
        completed_at: string | null;
        interview_type: string;
        interview_status: string;
        campus_id: string | null;
        host_user_id: string | null;
        notes: string | null;
        created_at: string;
        updated_at: string;
      }>;
      admissions_template_versions: Sprint1Row<{
        id: string;
        template_id: string;
        version_number: number;
        subject: string;
        body: string;
        changed_by: string | null;
        change_notes: string | null;
        created_at: string;
      }>;
      platform_audit_events: Sprint1Row<{
        id: string;
        school_id: string | null;
        module: string;
        entity_type: string;
        entity_id: string;
        workflow_id: string | null;
        workflow_key: string | null;
        action_type: string;
        actor_user_id: string | null;
        actor_role: string | null;
        ip_address: string | null;
        summary: string;
        before_state: Record<string, unknown> | null;
        after_state: Record<string, unknown> | null;
        metadata: Record<string, unknown>;
        is_system_event: boolean;
        created_at: string;
      }>;
      platform_timeline_events: Sprint1Row<{
        id: string;
        school_id: string | null;
        module: string;
        entity_type: string;
        entity_id: string;
        event_type: string;
        title: string;
        body: string;
        actor_user_id: string | null;
        related_entity_type: string | null;
        related_entity_id: string | null;
        metadata: Record<string, unknown>;
        occurred_at: string;
        created_at: string;
      }>;
      platform_queue_jobs: Sprint1Row<{
        id: string;
        school_id: string | null;
        module: string;
        job_type: string;
        entity_type: string | null;
        entity_id: string | null;
        source_table: string | null;
        source_id: string | null;
        status: string;
        priority: number;
        scheduled_for: string;
        started_at: string | null;
        completed_at: string | null;
        retry_count: number;
        max_retries: number;
        last_error: string | null;
        payload: Record<string, unknown>;
        created_at: string;
        updated_at: string;
      }>;
      platform_notification_templates: Sprint1Row<{
        id: string;
        school_id: string | null;
        module: string;
        template_key: string;
        name: string;
        category: string;
        channel: string;
        subject: string;
        body: string;
        merge_fields: unknown[];
        version_number: number;
        lifecycle_status: string;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      platform_template_versions: Sprint1Row<{
        id: string;
        template_id: string;
        version_number: number;
        subject: string;
        body: string;
        changed_by: string | null;
        change_notes: string | null;
        created_at: string;
      }>;
      platform_business_hours: Sprint1Row<{
        id: string;
        school_id: string;
        campus_id: string | null;
        schedule_type: string;
        timezone: string;
        day_of_week: number;
        open_time: string;
        close_time: string;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      platform_holidays: Sprint1Row<{
        id: string;
        school_id: string | null;
        name: string;
        holiday_date: string;
        is_school_break: boolean;
        timezone: string;
        created_at: string;
      }>;
      platform_escalation_rules: Sprint1Row<{
        id: string;
        school_id: string | null;
        module: string;
        rule_key: string;
        name: string;
        trigger_event: string;
        after_hours: number;
        condition_config: Record<string, unknown>;
        actions: unknown[];
        priority: number;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      platform_workflow_marketplace: Sprint1Row<{
        id: string;
        marketplace_key: string;
        name: string;
        description: string | null;
        module: string;
        category: string;
        trigger_event: string;
        workflow_definition: Record<string, unknown>;
        step_definitions: unknown[];
        tags: string[];
        is_published: boolean;
        install_count: number;
        created_at: string;
        updated_at: string;
      }>;
      platform_mission_control_items: Sprint1Row<{
        id: string;
        school_id: string | null;
        module: string;
        item_type: string;
        severity: string;
        title: string;
        body: string;
        entity_type: string | null;
        entity_id: string | null;
        assigned_role: string | null;
        assigned_user_id: string | null;
        href: string | null;
        is_resolved: boolean;
        resolved_at: string | null;
        metadata: Record<string, unknown>;
        created_at: string;
      }>;
      org_organizations: Sprint1Row<{
        id: string;
        name: string;
        slug: string;
        status: string;
        settings: Record<string, unknown>;
        created_at: string;
        updated_at: string;
      }>;
      org_regions: Sprint1Row<{
        id: string;
        organization_id: string;
        name: string;
        code: string | null;
        status: string;
        created_at: string;
        updated_at: string;
      }>;
      org_programs: Sprint1Row<{
        id: string;
        school_id: string;
        name: string;
        code: string;
        description: string | null;
        status: string;
        settings: Record<string, unknown>;
        created_at: string;
        updated_at: string;
      }>;
      org_departments: Sprint1Row<{
        id: string;
        school_id: string;
        campus_id: string | null;
        name: string;
        code: string;
        status: string;
        created_at: string;
        updated_at: string;
      }>;
      platform_permissions: {
        Row: {
          permission_key: string;
          name: string;
          description: string | null;
          module: string;
          category: string;
          sort_order: number;
        };
        Insert: {
          permission_key: string;
          name: string;
          description?: string | null;
          module: string;
          category?: string;
          sort_order?: number;
        };
        Update: Partial<{
          name: string;
          description: string | null;
          module: string;
          category: string;
          sort_order: number;
        }>;
      };
      platform_role_permissions: Sprint1Row<{
        id: string;
        role_id: string;
        permission_key: string;
        effect: string;
        created_at: string;
      }>;
      user_org_assignments: Sprint1Row<{
        id: string;
        user_id: string;
        school_id: string;
        campus_id: string | null;
        program_id: string | null;
        department_id: string | null;
        all_campuses: boolean;
        all_programs: boolean;
        is_primary: boolean;
        created_at: string;
      }>;
      platform_impersonation_sessions: Sprint1Row<{
        id: string;
        actor_user_id: string;
        target_user_id: string;
        reason: string;
        ip_address: string | null;
        user_agent: string | null;
        started_at: string;
        ended_at: string | null;
        is_active: boolean;
      }>;
      user_preferences: {
        Row: {
          user_id: string;
          timezone: string;
          language: string;
          theme: string;
          dashboard_layout: Record<string, unknown>;
          notifications: Record<string, unknown>;
          accessibility: Record<string, unknown>;
          communication: Record<string, unknown>;
          mission_control_widgets: Record<string, unknown>;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          timezone?: string;
          language?: string;
          theme?: string;
          dashboard_layout?: Record<string, unknown>;
          notifications?: Record<string, unknown>;
          accessibility?: Record<string, unknown>;
          communication?: Record<string, unknown>;
          mission_control_widgets?: Record<string, unknown>;
          updated_at?: string;
        };
        Update: Partial<{
          timezone: string;
          language: string;
          theme: string;
          dashboard_layout: Record<string, unknown>;
          notifications: Record<string, unknown>;
          accessibility: Record<string, unknown>;
          communication: Record<string, unknown>;
          mission_control_widgets: Record<string, unknown>;
          updated_at: string;
        }>;
      };
      school_branding: {
        Row: {
          school_id: string;
          logo_url: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          accent_color: string | null;
          custom_css: string | null;
          updated_at: string;
        };
        Insert: {
          school_id: string;
          logo_url?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          accent_color?: string | null;
          custom_css?: string | null;
          updated_at?: string;
        };
        Update: Partial<{
          logo_url: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          accent_color: string | null;
          custom_css: string | null;
          updated_at: string;
        }>;
      };
      family_households: Sprint1Row<{
        id: string;
        family_id: string;
        label: string;
        address: string | null;
        city: string | null;
        state: string | null;
        zip_code: string | null;
        is_primary: boolean;
        created_at: string;
      }>;
      student_authorized_contacts: Sprint1Row<{
        id: string;
        student_id: string;
        guardian_id: string | null;
        contact_type: string;
        first_name: string;
        last_name: string;
        email: string | null;
        phone: string | null;
        custody_notes: string | null;
        can_pick_up: boolean;
        receives_communications: boolean;
        is_active: boolean;
        created_at: string;
      }>;
      platform_security_events: Sprint1Row<{
        id: string;
        event_type: string;
        user_id: string | null;
        actor_user_id: string | null;
        school_id: string | null;
        ip_address: string | null;
        summary: string;
        metadata: Record<string, unknown>;
        created_at: string;
      }>;
      platform_scope_grants: Sprint1Row<{
        id: string;
        user_id: string;
        school_id: string;
        scope_type: string;
        program_id: string | null;
        department_id: string | null;
        grade_band: string | null;
        classroom_id: string | null;
        label: string | null;
        granted_permissions: string[];
        denied_permissions: string[];
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      platform_record_classifications: Sprint1Row<{
        id: string;
        school_id: string | null;
        module: string;
        entity_type: string;
        entity_id: string;
        classification: string;
        classified_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      platform_record_locks: Sprint1Row<{
        id: string;
        school_id: string | null;
        module: string;
        entity_type: string;
        entity_id: string;
        lock_reason: string;
        locked_by: string | null;
        locked_at: string;
        is_active: boolean;
      }>;
      platform_approval_rules: Sprint1Row<{
        id: string;
        school_id: string | null;
        rule_key: string;
        name: string;
        module: string;
        description: string | null;
        condition_config: Record<string, unknown>;
        approver_roles: string[];
        approver_permissions: string[];
        threshold_value: number | null;
        threshold_unit: string | null;
        priority: number;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      platform_approval_requests: Sprint1Row<{
        id: string;
        rule_id: string | null;
        school_id: string | null;
        module: string;
        entity_type: string;
        entity_id: string;
        title: string;
        summary: string;
        requested_by: string | null;
        status: string;
        decided_by: string | null;
        decided_at: string | null;
        decision_notes: string | null;
        metadata: Record<string, unknown>;
        created_at: string;
      }>;
      platform_digital_signatures: Sprint1Row<{
        id: string;
        school_id: string | null;
        module: string;
        document_type: string;
        entity_type: string;
        entity_id: string;
        signer_user_id: string | null;
        signer_name: string;
        signer_email: string | null;
        signed_at: string;
        ip_address: string | null;
        user_agent: string | null;
        device_info: Record<string, unknown>;
        document_version: string;
        document_hash: string | null;
        signature_payload: Record<string, unknown>;
        created_at: string;
      }>;
      platform_identity_providers: Sprint1Row<{
        id: string;
        provider_key: string;
        provider_type: string;
        name: string;
        is_enabled: boolean;
        organization_id: string | null;
        config: Record<string, unknown>;
        domain_allowlist: string[];
        role_mapping: Record<string, unknown>;
        created_at: string;
        updated_at: string;
      }>;
      user_mfa_settings: {
        Row: {
          user_id: string;
          mfa_required: boolean;
          preferred_method: string | null;
          totp_enabled: boolean;
          sms_enabled: boolean;
          email_verification_enabled: boolean;
          passkey_enabled: boolean;
          last_verified_at: string | null;
          metadata: Record<string, unknown>;
          updated_at: string;
        };
        Insert: { user_id: string; mfa_required?: boolean };
        Update: Partial<{ mfa_required: boolean; totp_enabled: boolean }>;
      };
      student_funding_sources: {
        Row: StudentFundingSource;
        Insert: Omit<StudentFundingSource, "created_at"> & { created_at?: string };
        Update: Partial<StudentFundingSource>;
      };
      sis_admissions_conversions: Sprint1Row<{
        id: string;
        application_id: string;
        lead_id: string;
        student_id: string;
        family_id: string | null;
        converted_at: string;
        converted_by: string | null;
        conversion_source: string;
        snapshot: Record<string, unknown>;
      }>;
      student_medical_profiles: Sprint1Row<{
        id: string;
        student_id: string;
        allergies: unknown[];
        medications: unknown[];
        diagnoses: unknown[];
        physician_name: string | null;
        physician_phone: string | null;
        physician_practice: string | null;
        insurance_carrier: string | null;
        insurance_policy_number: string | null;
        insurance_group_number: string | null;
        emergency_medical_plan: string | null;
        immunizations: unknown[];
        health_alerts: unknown[];
        seizure_plan: string | null;
        diabetes_plan: string | null;
        notes: string | null;
      }>;
      student_special_education_plans: Sprint1Row<{
        id: string;
        student_id: string;
        plan_type: string;
        status: string;
        eligibility_category: string | null;
        service_minutes: Record<string, unknown>;
        related_services: unknown[];
        accommodations: unknown[];
        modifications: unknown[];
        evaluation_date: string | null;
        annual_review_date: string | null;
        reevaluation_date: string | null;
        last_meeting_date: string | null;
        document_storage_path: string | null;
        notes: string | null;
      }>;
      student_attendance_records: Sprint1Row<{
        id: string;
        student_id: string;
        attendance_date: string;
        status: string;
        notes: string | null;
        parent_notified_at: string | null;
        recorded_by: string | null;
      }>;
      student_behavior_events: Sprint1Row<{
        id: string;
        student_id: string;
        event_type: string;
        title: string;
        description: string | null;
        severity: string;
        occurred_at: string;
        intervention_notes: string | null;
        restorative_action: string | null;
        parent_notified_at: string | null;
        recorded_by: string | null;
      }>;
      student_service_sessions: Sprint1Row<{
        id: string;
        student_id: string;
        service_type: string;
        provider_user_id: string | null;
        provider_name: string | null;
        scheduled_at: string | null;
        delivered_at: string | null;
        duration_minutes: number | null;
        session_status: string;
        notes: string | null;
      }>;
    };
  };
}
