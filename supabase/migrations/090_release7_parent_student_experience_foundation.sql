-- =========================================
-- RELEASE 7: PARENT & STUDENT EXPERIENCE PLATFORM
-- Extends SSIS, scheduling, finance, meetings — idempotent
-- =========================================

-- ---------------------------------------------------------------------------
-- 1. Unified parent/student access helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_parent_of_student(check_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (
      select 1 from public.student_family_link sfl
      where sfl.student_id = check_student_id and sfl.user_id = auth.uid()
    )
    or exists (
      select 1 from public.students s
      join public.guardians g on g.family_id = s.family_id
      where s.id = check_student_id and g.user_id = auth.uid()
    );
$$;

create or replace function public.can_access_student_record(check_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    is_enterprise_admin()
    or exists (
      select 1 from public.students s
      where s.id = check_student_id and can_access_school(s.school_id)
    )
    or exists (
      select 1 from public.student_family_link sfl
      where sfl.student_id = check_student_id and sfl.user_id = auth.uid()
    )
    or exists (
      select 1 from public.students s
      join public.guardians g on g.family_id = s.family_id
      where s.id = check_student_id and g.user_id = auth.uid()
    )
    or exists (
      select 1 from public.students s
      where s.id = check_student_id and s.user_id = auth.uid()
    );
$$;

-- ---------------------------------------------------------------------------
-- 2. Secure messaging
-- ---------------------------------------------------------------------------

create table if not exists public.portal_conversations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  family_id uuid references public.families(id) on delete set null,
  category text not null default 'general'
    check (category in ('general', 'teacher', 'therapist', 'finance', 'admissions', 'school_leader', 'hr')),
  subject text not null,
  status text not null default 'open'
    check (status in ('open', 'closed', 'archived')),
  created_by_user_id uuid references public.users(id) on delete set null,
  assigned_staff_user_id uuid references public.users(id) on delete set null,
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_portal_conversations_student on public.portal_conversations(student_id, status);
create index if not exists idx_portal_conversations_family on public.portal_conversations(family_id);

drop trigger if exists portal_conversations_set_updated_at on public.portal_conversations;
create trigger portal_conversations_set_updated_at
  before update on public.portal_conversations
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.portal_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.portal_conversations(id) on delete cascade,
  sender_user_id uuid references public.users(id) on delete set null,
  body text not null,
  message_category text not null default 'general'
    check (message_category in ('general', 'attendance', 'academic', 'behavior', 'financial', 'document', 'meeting')),
  translation_locale text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_portal_messages_conversation on public.portal_messages(conversation_id, created_at desc);

create table if not exists public.portal_message_reads (
  message_id uuid not null references public.portal_messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.portal_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.portal_messages(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Family notifications (post-enrollment)
-- ---------------------------------------------------------------------------

create table if not exists public.portal_family_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  category text not null default 'general'
    check (category in (
      'general', 'message', 'attendance', 'academic', 'behavior', 'financial',
      'document', 'meeting', 'scholarship', 'state_funding', 'announcement', 'task'
    )),
  title text not null,
  body text not null,
  href text,
  is_read boolean not null default false,
  read_at timestamptz,
  delivery_method text not null default 'portal'
    check (delivery_method in ('portal', 'email', 'sms', 'push')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_portal_family_notifications_user
  on public.portal_family_notifications(user_id, is_read, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Family forms center
-- ---------------------------------------------------------------------------

create table if not exists public.portal_form_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  form_key text not null,
  title text not null,
  description text,
  form_type text not null default 'custom'
    check (form_type in (
      're_enrollment', 'medical', 'emergency_contact', 'transportation',
      'technology', 'media_release', 'financial', 'scholarship', 'state_funding', 'custom'
    )),
  requires_signature boolean not null default false,
  is_active boolean not null default true,
  schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, form_key)
);

drop trigger if exists portal_form_templates_set_updated_at on public.portal_form_templates;
create trigger portal_form_templates_set_updated_at
  before update on public.portal_form_templates
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.portal_form_submissions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.portal_form_templates(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  family_id uuid references public.families(id) on delete set null,
  submitted_by_user_id uuid references public.users(id) on delete set null,
  answers jsonb not null default '{}'::jsonb,
  signature_id uuid references public.platform_digital_signatures(id) on delete set null,
  status text not null default 'submitted'
    check (status in ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_portal_form_submissions_family on public.portal_form_submissions(family_id, submitted_at desc);

-- ---------------------------------------------------------------------------
-- 5. Parent conference center extensions
-- ---------------------------------------------------------------------------

alter table public.student_instructional_meetings
  add column if not exists parent_visible boolean not null default true;

alter table public.student_instructional_meetings
  add column if not exists parent_response_status text
    check (parent_response_status is null or parent_response_status in ('pending', 'accepted', 'declined', 'rescheduled'));

alter table public.student_instructional_meetings
  add column if not exists virtual_meeting_url text;

alter table public.student_instructional_meetings
  add column if not exists parent_notes text;

create table if not exists public.portal_conference_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  meeting_id uuid references public.student_instructional_meetings(id) on delete set null,
  requested_by_user_id uuid references public.users(id) on delete set null,
  preferred_times jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_portal_conference_requests_student
  on public.portal_conference_requests(student_id, status);

drop trigger if exists portal_conference_requests_set_updated_at on public.portal_conference_requests;
create trigger portal_conference_requests_set_updated_at
  before update on public.portal_conference_requests
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Calendar export tokens (ICS)
-- ---------------------------------------------------------------------------

create table if not exists public.portal_calendar_export_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  label text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_portal_calendar_tokens_user on public.portal_calendar_export_tokens(user_id);

-- ---------------------------------------------------------------------------
-- 7. Portal permissions
-- ---------------------------------------------------------------------------

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order)
values
  ('portal.messaging', 'Portal Messaging', 'Send and receive secure portal messages', 'parent_portal', 'portal', 210),
  ('portal.notifications.manage', 'Portal Notifications', 'Manage family notification preferences', 'parent_portal', 'portal', 211),
  ('portal.forms.submit', 'Portal Forms', 'Submit family forms and signatures', 'parent_portal', 'portal', 212),
  ('portal.conferences', 'Portal Conferences', 'Request and manage parent conferences', 'parent_portal', 'portal', 213)
on conflict (permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name = 'PARENT'
  and p.permission_key in (
    'portal.messaging', 'portal.notifications.manage', 'portal.forms.submit', 'portal.conferences'
  )
on conflict do nothing;

-- Seed default family form templates per school (idempotent via form_key)
insert into public.portal_form_templates (school_id, form_key, title, description, form_type, requires_signature)
select s.id, 'annual_re_enrollment', 'Annual Re-Enrollment', 'Confirm enrollment for the upcoming school year.', 're_enrollment', true
from public.schools s
where not exists (
  select 1 from public.portal_form_templates t
  where t.school_id = s.id and t.form_key = 'annual_re_enrollment'
);

insert into public.portal_form_templates (school_id, form_key, title, description, form_type, requires_signature)
select s.id, 'emergency_contacts', 'Emergency Contact Update', 'Update emergency contacts and authorized pickups.', 'emergency_contact', false
from public.schools s
where not exists (
  select 1 from public.portal_form_templates t
  where t.school_id = s.id and t.form_key = 'emergency_contacts'
);

insert into public.portal_form_templates (school_id, form_key, title, description, form_type, requires_signature)
select s.id, 'media_release', 'Media Release', 'Photo and video release for school communications.', 'media_release', true
from public.schools s
where not exists (
  select 1 from public.portal_form_templates t
  where t.school_id = s.id and t.form_key = 'media_release'
);
