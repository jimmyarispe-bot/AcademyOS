-- =========================================
-- RELEASE 10.1 ADDENDUM: Universal Student & Family Deadline Engine
-- Extends compliance_obligations — idempotent
-- =========================================

alter table public.compliance_categories
  add column if not exists audience text not null default 'staff'
    check (audience is null or audience in ('parent', 'student', 'teacher', 'staff', 'executive', 'all'));

alter table public.compliance_obligations
  add column if not exists assignee_type text not null default 'staff'
    check (assignee_type in ('parent', 'student', 'teacher', 'staff', 'executive'));

alter table public.compliance_obligations
  add column if not exists student_id uuid references public.students(id) on delete cascade;

alter table public.compliance_obligations
  add column if not exists family_id uuid references public.families(id) on delete cascade;

alter table public.compliance_obligations
  add column if not exists employee_id uuid references public.employees(id) on delete set null;

alter table public.compliance_obligations
  add column if not exists guardian_user_id uuid references public.users(id) on delete set null;

alter table public.compliance_obligations
  add column if not exists action_type text
    check (action_type is null or action_type in ('pay', 'upload', 'sign', 'complete', 'review', 'submit'));

alter table public.compliance_obligations
  add column if not exists action_href text;

alter table public.compliance_obligations
  add column if not exists parent_can_complete boolean not null default false;

alter table public.compliance_obligations
  add column if not exists subject_domain text;

create index if not exists idx_compliance_obligations_assignee
  on public.compliance_obligations(assignee_type, guardian_user_id, student_id, employee_id, due_date);

create index if not exists idx_compliance_obligations_student
  on public.compliance_obligations(student_id, status, due_date) where student_id is not null;

-- Parent & family deadline categories
insert into public.compliance_categories (category_key, name, domain, audience, is_system, sort_order) values
  ('parent_tuition_due', 'Tuition Payment Due', 'finance', 'parent', true, 200),
  ('parent_payment_plan', 'Payment Plan Installment', 'finance', 'parent', true, 201),
  ('parent_scholarship_renewal', 'Scholarship Renewal', 'finance', 'parent', true, 202),
  ('parent_state_funding_renewal', 'State Funding Renewal', 'finance', 'parent', true, 203),
  ('parent_esa_voucher_renewal', 'ESA/Voucher Renewal', 'finance', 'parent', true, 204),
  ('parent_financial_aid', 'Financial Aid Application', 'finance', 'parent', true, 205),
  ('parent_reenrollment', 'Re-enrollment', 'student_services', 'parent', true, 210),
  ('parent_emergency_contact', 'Emergency Contact Update', 'student_services', 'parent', true, 211),
  ('parent_medical_form', 'Medical Form Renewal', 'student_services', 'parent', true, 212),
  ('parent_immunization', 'Immunization Update', 'student_services', 'parent', true, 213),
  ('parent_insurance_info', 'Insurance Information', 'insurance', 'parent', true, 214),
  ('parent_handbook_ack', 'Handbook Acknowledgement', 'governance', 'parent', true, 215),
  ('parent_technology_agreement', 'Technology Agreement', 'technology', 'parent', true, 216),
  ('parent_media_release', 'Media Release Form', 'governance', 'parent', true, 217),
  ('parent_admissions_docs', 'Missing Admissions Documents', 'governance', 'parent', true, 218),
  ('parent_enrollment_docs', 'Missing Enrollment Documents', 'governance', 'parent', true, 219),
  ('student_assignment', 'Assignment Due', 'student_services', 'student', true, 300),
  ('student_homework', 'Homework Due', 'student_services', 'student', true, 301),
  ('student_project', 'Project Due', 'student_services', 'student', true, 302),
  ('student_assessment', 'Assessment Due', 'student_services', 'student', true, 303),
  ('student_map_testing', 'MAP Testing', 'student_services', 'student', true, 304),
  ('student_benchmark', 'Benchmark Assessment', 'student_services', 'student', true, 305),
  ('student_progress_monitoring', 'Progress Monitoring', 'student_services', 'student', true, 306),
  ('student_reading_goal', 'Reading Goal', 'student_services', 'student', true, 307),
  ('student_writing_goal', 'Writing Goal', 'student_services', 'student', true, 308),
  ('student_math_goal', 'Math Goal', 'student_services', 'student', true, 309),
  ('student_literacy_checkpoint', 'Structured Literacy Checkpoint', 'student_services', 'student', true, 310),
  ('student_intervention_review', 'Intervention Review', 'student_services', 'student', true, 311),
  ('student_iep_goal', 'IEP Goal', 'student_services', 'student', true, 312),
  ('student_504_goal', '504 Goal', 'student_services', 'student', true, 313),
  ('student_growth_plan', 'Student Growth Plan Review', 'student_services', 'student', true, 314),
  ('student_therapy_practice', 'Therapy Home Practice', 'student_services', 'student', true, 315),
  ('student_graduation_req', 'Graduation Requirement', 'student_services', 'student', true, 316),
  ('teacher_attendance', 'Attendance Submission', 'hr', 'teacher', true, 400),
  ('teacher_lesson_docs', 'Lesson Documentation', 'hr', 'teacher', true, 401),
  ('teacher_session_notes', 'Session Notes', 'hr', 'teacher', true, 402),
  ('teacher_progress_update', 'Progress Monitoring Update', 'hr', 'teacher', true, 403),
  ('teacher_artifact_upload', 'Artifact Upload', 'hr', 'teacher', true, 404),
  ('teacher_report_card', 'Report Card', 'hr', 'teacher', true, 405),
  ('teacher_progress_report', 'Progress Report', 'hr', 'teacher', true, 406),
  ('teacher_parent_followup', 'Parent Follow-up', 'hr', 'teacher', true, 407),
  ('teacher_iep_progress', 'IEP Progress Update', 'student_services', 'teacher', true, 408),
  ('teacher_service_minutes', 'Service Minute Documentation', 'student_services', 'teacher', true, 409),
  ('leader_teacher_observation', 'Teacher Observation', 'governance', 'executive', true, 500),
  ('leader_employee_eval', 'Employee Evaluation', 'hr', 'executive', true, 501),
  ('leader_budget_approval', 'Budget Approval', 'finance', 'executive', true, 502),
  ('leader_compliance_approval', 'Compliance Approval', 'governance', 'executive', true, 503),
  ('leader_enrollment_approval', 'Enrollment Approval', 'governance', 'executive', true, 504),
  ('leader_strategic_milestone', 'Strategic Planning Milestone', 'governance', 'executive', true, 505),
  ('leader_school_improvement', 'School Improvement Plan Task', 'governance', 'executive', true, 506)
on conflict (category_key) do nothing;
