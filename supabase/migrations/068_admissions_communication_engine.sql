-- =========================================
-- ADMISSIONS COMMUNICATION AUTOMATION ENGINE (068)
-- Templates, queue, notifications, extended audit
-- Idempotent: safe to re-run
-- =========================================

-- Extend communications audit table
alter table public.admissions_communications
  add column if not exists template_id uuid;

alter table public.admissions_communications
  add column if not exists template_key text;

alter table public.admissions_communications
  add column if not exists trigger_event text;

alter table public.admissions_communications
  add column if not exists delivery_status text not null default 'sent'
    check (delivery_status in ('pending', 'sent', 'delivered', 'failed', 'logged'));

alter table public.admissions_communications
  add column if not exists open_status text not null default 'unknown'
    check (open_status in ('unknown', 'opened', 'unopened'));

alter table public.admissions_communications
  add column if not exists opened_at timestamptz;

alter table public.admissions_communications
  add column if not exists recipient_phone text;

alter table public.admissions_communications
  add column if not exists is_staff_notification boolean not null default false;

alter table public.admissions_communications
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Communication templates (org-wide or per-school)
create table if not exists public.admissions_communication_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  template_key text not null,
  name text not null,
  channel text not null default 'email'
    check (channel in ('email', 'sms', 'portal_notification', 'internal_note')),
  trigger_event text not null,
  subject text not null default '',
  body text not null,
  delay_hours integer not null default 0 check (delay_hours >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admissions_communication_templates_key_unique
    unique (school_id, template_key)
);

create index if not exists idx_comm_templates_trigger
  on public.admissions_communication_templates(trigger_event);

create index if not exists idx_comm_templates_school
  on public.admissions_communication_templates(school_id);

drop trigger if exists admissions_communication_templates_set_updated_at
  on public.admissions_communication_templates;
create trigger admissions_communication_templates_set_updated_at
  before update on public.admissions_communication_templates
  for each row execute function public.trigger_set_updated_at();

-- Scheduled communication queue
create table if not exists public.admissions_communication_queue (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.admissions_leads(id) on delete cascade,
  application_id uuid references public.admissions_applications(id) on delete set null,
  template_id uuid references public.admissions_communication_templates(id) on delete set null,
  template_key text not null,
  trigger_event text not null,
  channel text not null default 'email',
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'cancelled', 'failed')),
  custom_subject text,
  custom_body text,
  sent_communication_id uuid references public.admissions_communications(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_comm_queue_scheduled
  on public.admissions_communication_queue(scheduled_for)
  where status = 'pending';

create index if not exists idx_comm_queue_lead
  on public.admissions_communication_queue(lead_id);

drop trigger if exists admissions_communication_queue_set_updated_at
  on public.admissions_communication_queue;
create trigger admissions_communication_queue_set_updated_at
  before update on public.admissions_communication_queue
  for each row execute function public.trigger_set_updated_at();

-- Staff dashboard notifications
create table if not exists public.admissions_staff_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  lead_id uuid references public.admissions_leads(id) on delete cascade,
  application_id uuid references public.admissions_applications(id) on delete set null,
  notification_type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_staff_notifications_user
  on public.admissions_staff_notifications(user_id, read_at);

-- Parent portal notifications
create table if not exists public.admissions_portal_notifications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.admissions_leads(id) on delete cascade,
  application_id uuid references public.admissions_applications(id) on delete set null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_portal_notifications_lead
  on public.admissions_portal_notifications(lead_id);

-- Seed org-wide default templates
insert into public.admissions_communication_templates
  (school_id, template_key, name, channel, trigger_event, subject, body, delay_hours)
values
  (null, 'inquiry_thank_you_email', 'Inquiry Thank You', 'email', 'inquiry_submitted',
   'Thank you for your inquiry — {{student_name}}',
   E'Dear {{parent_name}},\n\nThank you for your interest in {{school_name}}. We received your inquiry for {{student_name}}.\n\nNext steps:\n1. Sign in to the Parent Portal: {{portal_link}}\n2. Begin your application: {{application_link}}\n\nWe support students with learning differences and look forward to connecting with your family.\n\nWarm regards,\n{{school_name}} Admissions',
   0),
  (null, 'inquiry_portal_notification', 'Inquiry Portal Welcome', 'portal_notification', 'inquiry_submitted',
   'Welcome to {{school_name}}',
   'Your inquiry for {{student_name}} was received. Visit your portal to begin the application.',
   0),
  (null, 'tour_confirmation_email', 'Tour Confirmation', 'email', 'tour_scheduled',
   'Tour confirmed — {{student_name}} at {{campus_name}}',
   E'Dear {{parent_name}},\n\nYour campus tour is confirmed:\n\nDate/Time: {{tour_datetime}}\nCampus: {{campus_name}}\nDirections: {{campus_address}}\nParking: {{parking_info}}\n\nWhat to expect: Meet our admissions team, tour classrooms, and discuss {{student_name}}''s learning needs.\n\nCalendar invite attached.\n\n{{school_name}} Admissions',
   0),
  (null, 'tour_reminder_24h', 'Tour Reminder 24h', 'email', 'tour_reminder_24h',
   'Reminder: Tour tomorrow for {{student_name}}',
   E'Dear {{parent_name}},\n\nThis is a reminder that your tour at {{campus_name}} is scheduled for {{tour_datetime}}.\n\nWe look forward to seeing you!\n\n{{school_name}} Admissions',
   24),
  (null, 'tour_reminder_2h', 'Tour Reminder 2h', 'sms', 'tour_reminder_2h',
   '',
   'Reminder: {{school_name}} tour for {{student_name}} in 2 hours at {{campus_name}}. See you soon!',
   2),
  (null, 'application_started_email', 'Application Started', 'email', 'application_started',
   'Welcome to your application portal — {{student_name}}',
   E'Dear {{parent_name}},\n\nYou have started the application for {{student_name}} at {{school_name}}.\n\nYour progress is saved automatically. Return anytime: {{portal_link}}\n\n{{school_name}} Admissions',
   0),
  (null, 'application_incomplete_3d', 'Application Incomplete 3 Days', 'email', 'application_incomplete_3d',
   'Complete {{student_name}}''s application',
   E'Dear {{parent_name}},\n\nYour application for {{student_name}} is incomplete.\n\nMissing items:\n{{missing_items}}\n\nContinue here: {{portal_link}}\n\n{{school_name}} Admissions',
   72),
  (null, 'application_incomplete_7d', 'Application Incomplete 7 Days', 'email', 'application_incomplete_7d',
   'Reminder: Application still incomplete',
   E'Dear {{parent_name}},\n\nIt has been one week since you started {{student_name}}''s application.\n\nMissing:\n{{missing_items}}\n\nPortal: {{portal_link}}',
   168),
  (null, 'application_incomplete_14d', 'Application Incomplete 14 Days', 'email', 'application_incomplete_14d',
   'Final reminder: Complete application',
   E'Dear {{parent_name}},\n\nPlease complete {{student_name}}''s application. Missing items:\n{{missing_items}}\n\n{{portal_link}}',
   336),
  (null, 'missing_documents_email', 'Missing Documents', 'email', 'missing_documents',
   'Documents needed for {{student_name}}',
   E'Dear {{parent_name}},\n\nWe need the following documents:\n{{missing_documents}}\n\nUpload directly: {{upload_link}}\n\n{{school_name}} Admissions',
   0),
  (null, 'state_funding_needed_email', 'State Funding Verification Needed', 'email', 'state_funding_verification_needed',
   'State funding verification required — {{student_name}}',
   E'Dear {{parent_name}},\n\nPlease provide state funding documentation for {{funding_program}}:\n- Award Letter\n- Award Amount: {{award_amount}}\n- Award ID: {{award_id}}\n- State Student ID: {{state_student_id}}\n\nUpload: {{upload_link}}\n\n{{school_name}} Admissions',
   0),
  (null, 'funding_approved_email', 'Funding Verified', 'email', 'funding_verification_approved',
   'State funding verified — {{student_name}}',
   E'Dear {{parent_name}},\n\nYour state funding for {{student_name}} has been verified.\n\nNext steps: {{next_steps}}\n\nPortal: {{portal_link}}',
   0),
  (null, 'funding_rejected_email', 'Funding Rejected', 'email', 'funding_verification_rejected',
   'State funding verification update — {{student_name}}',
   E'Dear {{parent_name}},\n\nWe could not verify state funding for {{student_name}}.\n\nReason: {{rejection_reason}}\n\nPlease upload corrected documents: {{upload_link}}',
   0),
  (null, 'financial_aid_requested_email', 'Financial Aid Documents', 'email', 'financial_aid_documents_requested',
   'Financial aid documents needed — {{student_name}}',
   E'Dear {{parent_name}},\n\nPlease upload the following for financial aid review:\n- Federal tax returns (prior 2 years)\n- Supporting income documentation\n\nUpload: {{upload_link}}',
   0),
  (null, 'application_submitted_email', 'Application Submitted', 'email', 'application_submitted',
   'Application received — {{student_name}}',
   E'Dear {{parent_name}},\n\nWe received {{student_name}}''s application.\n\nTimeline:\n1. Document review (3-5 business days)\n2. Admissions review\n3. Decision within {{decision_timeframe}}\n\nPortal: {{portal_link}}',
   0),
  (null, 'interview_confirmation_email', 'Interview Confirmation', 'email', 'interview_scheduled',
   'Interview confirmed — {{student_name}}',
   E'Dear {{parent_name}},\n\nInterview scheduled for {{student_name}}:\n\nDate/Time: {{interview_datetime}}\nLocation: {{campus_name}}\n\nPlease prepare: recent report cards, IEP/evaluation summaries if applicable.\n\n{{school_name}} Admissions',
   0),
  (null, 'interview_reminder_24h', 'Interview Reminder 24h', 'email', 'interview_reminder_24h',
   'Interview tomorrow — {{student_name}}',
   'Dear {{parent_name}}, reminder: interview for {{student_name}} tomorrow at {{interview_datetime}}.',
   24),
  (null, 'interview_reminder_2h', 'Interview Reminder 2h', 'sms', 'interview_reminder_2h',
   '',
   'Reminder: {{student_name}} interview at {{school_name}} in 2 hours.',
   2),
  (null, 'additional_info_email', 'Additional Information Requested', 'email', 'additional_info_requested',
   'Information needed — {{student_name}}',
   E'Dear {{parent_name}},\n\nWe need additional information for {{student_name}}:\n\n{{requested_items}}\n\nDeadline: {{deadline}}\nUpload: {{upload_link}}',
   0),
  (null, 'student_accepted_email', 'Student Accepted', 'email', 'student_accepted',
   'Congratulations! {{student_name}} is accepted',
   E'Dear {{parent_name}},\n\nCongratulations! {{student_name}} has been accepted to {{school_name}} ({{program_name}}).\n\nEnrollment steps:\n1. Complete enrollment packet: {{portal_link}}\n2. Review tuition: {{tuition_info}}\n3. Orientation: {{orientation_info}}\n4. Technology setup: {{technology_info}}\n\nWelcome to The Academy!\n\n{{school_name}} Admissions',
   0),
  (null, 'student_waitlisted_email', 'Student Waitlisted', 'email', 'student_waitlisted',
   'Waitlist update — {{student_name}}',
   E'Dear {{parent_name}},\n\n{{student_name}} has been placed on our waitlist for {{program_name}}.\n\nEstimated timeline: {{waitlist_timeline}}\n\nWe will send monthly status updates.\n\n{{school_name}} Admissions',
   0),
  (null, 'student_declined_email', 'Student Declined', 'email', 'student_declined',
   'Admissions decision — {{student_name}}',
   E'Dear {{parent_name}},\n\nThank you for applying to {{school_name}}. After careful review, we are unable to offer enrollment to {{student_name}} at this time.\n\nYou may reapply in a future enrollment period. We wish your family all the best.\n\n{{school_name}} Admissions',
   0),
  (null, 'enrollment_completed_email', 'Enrollment Completed', 'email', 'enrollment_completed',
   'Welcome to The Academy — {{student_name}}',
   E'Dear {{parent_name}},\n\nEnrollment is complete for {{student_name}}!\n\nSchedule: {{student_schedule}}\nTeacher: {{teacher_assignment}}\nFirst day: {{first_day_info}}\nParent handbook: {{handbook_link}}\n\n{{school_name}}',
   0),
  (null, 'staff_new_inquiry', 'Staff: New Inquiry', 'internal_note', 'staff_new_inquiry',
   'New inquiry: {{student_name}}',
   'New inquiry submitted for {{student_name}} ({{program_name}}). Guardian: {{parent_email}}',
   0),
  (null, 'staff_application_started', 'Staff: Application Started', 'internal_note', 'staff_application_started',
   'Application started: {{student_name}}',
   '{{parent_name}} started the application for {{student_name}}.',
   0),
  (null, 'staff_documents_uploaded', 'Staff: Documents Uploaded', 'internal_note', 'staff_documents_uploaded',
   'Documents uploaded: {{student_name}}',
   'New documents uploaded for {{student_name}}: {{uploaded_documents}}',
   0),
  (null, 'staff_funding_verified', 'Staff: Funding Verified', 'internal_note', 'staff_funding_verified',
   'Funding verified: {{student_name}}',
   'State funding verified for {{student_name}} — {{funding_program}}',
   0),
  (null, 'staff_financial_aid_submitted', 'Staff: Financial Aid Submitted', 'internal_note', 'staff_financial_aid_submitted',
   'Financial aid submitted: {{student_name}}',
   'Financial aid application submitted for {{student_name}}.',
   0),
  (null, 'staff_application_submitted', 'Staff: Application Submitted', 'internal_note', 'staff_application_submitted',
   'Application submitted: {{student_name}}',
   'Application submitted for {{student_name}} — ready for review.',
   0),
  (null, 'staff_application_accepted', 'Staff: Application Accepted', 'internal_note', 'staff_application_accepted',
   'Student accepted: {{student_name}}',
   '{{student_name}} accepted. Begin enrollment workflow.',
   0)
on conflict (school_id, template_key) do update set
  name = excluded.name,
  subject = excluded.subject,
  body = excluded.body,
  delay_hours = excluded.delay_hours,
  trigger_event = excluded.trigger_event,
  channel = excluded.channel;

notify pgrst, 'reload schema';
