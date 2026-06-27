-- =========================================
-- RELEASE 10.2: ENTERPRISE WORK MANAGEMENT PLATFORM
-- Central work engine — idempotent, extends (does not replace) existing systems
-- =========================================

-- ---------------------------------------------------------------------------
-- 1. Playbooks & templates
-- ---------------------------------------------------------------------------

create table if not exists public.work_playbooks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  playbook_key text not null,
  name text not null,
  description text,
  project_type text not null default 'custom'
    check (project_type in (
      'admissions','enrollment','instruction','student_success','special_education',
      'intervention','therapy','finance','payroll','scholarships','state_funding',
      'hr','hiring','onboarding','performance_improvement','facilities','maintenance',
      'technology','compliance','accreditation','strategic_plan','board','marketing',
      'fundraising','grant','capital_project','construction','transportation',
      'food_service','emergency_response','custom'
    )),
  category text not null default 'operations',
  is_system boolean not null default false,
  is_active boolean not null default true,
  estimated_duration_days integer,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, playbook_key)
);

create index if not exists idx_work_playbooks_school on public.work_playbooks(school_id, is_active);

create table if not exists public.work_playbook_steps (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references public.work_playbooks(id) on delete cascade,
  step_order integer not null default 0,
  title text not null,
  description text,
  task_type text not null default 'task'
    check (task_type in ('task','subtask','milestone','approval','meeting','document','compliance')),
  default_priority text not null default 'normal'
    check (default_priority in ('low','normal','high','critical')),
  default_risk text not null default 'medium'
    check (default_risk in ('low','medium','high','critical')),
  offset_days integer not null default 0,
  estimated_hours numeric(8,2),
  requires_approval boolean not null default false,
  creates_compliance boolean not null default false,
  compliance_category_key text,
  creates_meeting boolean not null default false,
  assigned_role text,
  checklist jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_work_playbook_steps_playbook on public.work_playbook_steps(playbook_id, step_order);

create table if not exists public.work_playbook_runs (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references public.work_playbooks(id) on delete cascade,
  project_id uuid,
  school_id uuid references public.schools(id) on delete cascade,
  status text not null default 'running'
    check (status in ('running','completed','cancelled','failed')),
  started_by uuid references public.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- 2. Projects
-- ---------------------------------------------------------------------------

create table if not exists public.work_projects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete set null,
  department text,
  program text,
  project_key text,
  name text not null,
  description text,
  project_type text not null default 'custom'
    check (project_type in (
      'admissions','enrollment','instruction','student_success','special_education',
      'intervention','therapy','finance','payroll','scholarships','state_funding',
      'hr','hiring','onboarding','performance_improvement','facilities','maintenance',
      'technology','compliance','accreditation','strategic_plan','board','marketing',
      'fundraising','grant','capital_project','construction','transportation',
      'food_service','emergency_response','custom'
    )),
  status text not null default 'active'
    check (status in ('draft','planning','active','on_hold','blocked','completed','cancelled','archived')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','critical')),
  risk_level text not null default 'medium'
    check (risk_level in ('low','medium','high','critical')),
  health_indicator text not null default 'green'
    check (health_indicator in ('green','yellow','red')),
  completion_pct numeric(5,2) not null default 0 check (completion_pct >= 0 and completion_pct <= 100),
  budget_amount numeric(14,2),
  budget_spent numeric(14,2) not null default 0,
  start_date date,
  target_date date,
  completed_date date,
  owner_user_id uuid references public.users(id) on delete set null,
  playbook_id uuid references public.work_playbooks(id) on delete set null,
  playbook_run_id uuid references public.work_playbook_runs(id) on delete set null,
  source_module text,
  source_entity_type text,
  source_entity_id uuid,
  student_id uuid references public.students(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  family_id uuid references public.families(id) on delete set null,
  grant_id uuid,
  scholarship_application_id uuid references public.scholarship_applications(id) on delete set null,
  compliance_requirement_id uuid references public.executive_compliance_requirements(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_work_projects_school on public.work_projects(school_id, status);
create index if not exists idx_work_projects_owner on public.work_projects(owner_user_id, status);
create index if not exists idx_work_projects_type on public.work_projects(project_type, status);

alter table public.work_playbook_runs
  drop constraint if exists work_playbook_runs_project_id_fkey;
alter table public.work_playbook_runs
  add constraint work_playbook_runs_project_id_fkey
  foreign key (project_id) references public.work_projects(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 3. Milestones
-- ---------------------------------------------------------------------------

create table if not exists public.work_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.work_projects(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  status text not null default 'pending'
    check (status in ('pending','in_progress','completed','overdue','cancelled')),
  sort_order integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_work_milestones_project on public.work_milestones(project_id, due_date);

-- ---------------------------------------------------------------------------
-- 4. Tasks (includes subtasks via parent_task_id)
-- ---------------------------------------------------------------------------

create table if not exists public.work_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.work_projects(id) on delete cascade,
  parent_task_id uuid references public.work_tasks(id) on delete cascade,
  playbook_step_id uuid references public.work_playbook_steps(id) on delete set null,
  title text not null,
  description text,
  task_type text not null default 'task'
    check (task_type in ('task','subtask','milestone','approval','meeting','document','compliance')),
  status text not null default 'not_started'
    check (status in (
      'not_started','in_progress','waiting','blocked','needs_review',
      'approved','completed','cancelled','deferred'
    )),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','critical')),
  risk_level text not null default 'medium'
    check (risk_level in ('low','medium','high','critical')),
  completion_pct numeric(5,2) not null default 0 check (completion_pct >= 0 and completion_pct <= 100),
  estimated_hours numeric(8,2),
  actual_hours numeric(8,2) not null default 0,
  due_date date,
  start_date date,
  completed_date date,
  owner_user_id uuid references public.users(id) on delete set null,
  school_id uuid references public.schools(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete set null,
  department text,
  program text,
  student_id uuid references public.students(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  family_id uuid references public.families(id) on delete set null,
  compliance_obligation_id uuid references public.compliance_obligations(id) on delete set null,
  mission_control_item_id uuid,
  meeting_id uuid references public.student_instructional_meetings(id) on delete set null,
  approval_request_id uuid references public.platform_approval_requests(id) on delete set null,
  calendar_event_id uuid,
  financial_transaction_id uuid,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_work_tasks_project on public.work_tasks(project_id, status);
create index if not exists idx_work_tasks_owner on public.work_tasks(owner_user_id, status, due_date);
create index if not exists idx_work_tasks_parent on public.work_tasks(parent_task_id);
create index if not exists idx_work_tasks_due on public.work_tasks(due_date, status) where due_date is not null;

create table if not exists public.work_task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.work_tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'assignee'
    check (role in ('assignee','reviewer','approver','watcher')),
  assigned_at timestamptz not null default now(),
  unique (task_id, user_id, role)
);

create index if not exists idx_work_task_assignees_user on public.work_task_assignees(user_id);

create table if not exists public.work_task_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.work_tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.work_tasks(id) on delete cascade,
  dependency_type text not null default 'finish_to_start'
    check (dependency_type in ('finish_to_start','start_to_start','finish_to_finish')),
  created_at timestamptz not null default now(),
  unique (task_id, depends_on_task_id)
);

-- ---------------------------------------------------------------------------
-- 5. Checklists
-- ---------------------------------------------------------------------------

create table if not exists public.work_task_checklists (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.work_tasks(id) on delete cascade,
  title text not null default 'Checklist',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.work_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.work_task_checklists(id) on delete cascade,
  label text not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.users(id) on delete set null,
  sort_order integer not null default 0
);

-- ---------------------------------------------------------------------------
-- 6. Comments, attachments, activity, time
-- ---------------------------------------------------------------------------

create table if not exists public.work_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.work_tasks(id) on delete cascade,
  author_user_id uuid references public.users(id) on delete set null,
  body text not null,
  is_internal boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.work_tasks(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  mime_type text,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.work_activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.work_projects(id) on delete cascade,
  task_id uuid references public.work_tasks(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  action_type text not null,
  summary text not null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_work_activity_project on public.work_activity_log(project_id, occurred_at desc);
create index if not exists idx_work_activity_task on public.work_activity_log(task_id, occurred_at desc);

create table if not exists public.work_time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.work_tasks(id) on delete cascade,
  project_id uuid references public.work_projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  entry_date date not null default current_date,
  hours numeric(8,2) not null check (hours > 0),
  is_billable boolean not null default false,
  funding_source text,
  grant_allocation text,
  payroll_allocation text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_work_time_entries_user on public.work_time_entries(user_id, entry_date desc);

-- ---------------------------------------------------------------------------
-- 7. Risks & status history
-- ---------------------------------------------------------------------------

create table if not exists public.work_project_risks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.work_projects(id) on delete cascade,
  title text not null,
  description text,
  risk_score numeric(5,2) not null default 50 check (risk_score >= 0 and risk_score <= 100),
  likelihood text not null default 'medium'
    check (likelihood in ('low','medium','high')),
  impact text not null default 'medium'
    check (impact in ('low','medium','high','critical')),
  status text not null default 'open'
    check (status in ('open','mitigated','accepted','closed')),
  mitigation_plan text,
  owner_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.work_status_history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('project','task','milestone')),
  entity_id uuid not null,
  from_status text,
  to_status text not null,
  changed_by uuid references public.users(id) on delete set null,
  reason text,
  changed_at timestamptz not null default now()
);

create index if not exists idx_work_status_history_entity on public.work_status_history(entity_type, entity_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- 8. Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists work_playbooks_set_updated_at on public.work_playbooks;
create trigger work_playbooks_set_updated_at
  before update on public.work_playbooks
  for each row execute function public.trigger_set_updated_at();

drop trigger if exists work_projects_set_updated_at on public.work_projects;
create trigger work_projects_set_updated_at
  before update on public.work_projects
  for each row execute function public.trigger_set_updated_at();

drop trigger if exists work_tasks_set_updated_at on public.work_tasks;
create trigger work_tasks_set_updated_at
  before update on public.work_tasks
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. Reporting views
-- ---------------------------------------------------------------------------

create or replace view public.rpt_work_project_summary as
select
  p.school_id,
  sch.name as school_name,
  p.department,
  p.project_type,
  p.status,
  p.health_indicator,
  count(*) as project_count,
  avg(p.completion_pct) as avg_completion_pct,
  count(*) filter (where p.target_date < current_date and p.status not in ('completed','cancelled','archived')) as delayed_count,
  sum(p.budget_amount) as total_budget,
  sum(p.budget_spent) as total_spent
from public.work_projects p
left join public.schools sch on sch.id = p.school_id
where p.status not in ('archived')
group by p.school_id, sch.name, p.department, p.project_type, p.status, p.health_indicator;

create or replace view public.rpt_work_task_summary as
select
  t.school_id,
  t.status,
  t.priority,
  count(*) as task_count,
  count(*) filter (where t.due_date < current_date and t.status not in ('completed','cancelled')) as overdue_count,
  sum(t.estimated_hours) as total_estimated_hours,
  sum(t.actual_hours) as total_actual_hours
from public.work_tasks t
where t.status not in ('cancelled')
group by t.school_id, t.status, t.priority;

grant select on public.rpt_work_project_summary to authenticated;
grant select on public.rpt_work_task_summary to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Permissions
-- ---------------------------------------------------------------------------

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order)
values
  ('work.view', 'Work View', 'View projects, tasks, and workload', 'work', 'work', 410),
  ('work.manage', 'Work Manage', 'Create and update projects and tasks', 'work', 'work', 411),
  ('work.admin', 'Work Admin', 'Configure playbooks and templates', 'work', 'work', 412),
  ('work.reports', 'Work Reports', 'Export work management reports', 'work', 'work', 413),
  ('work.executive', 'Work Executive', 'Executive work analytics', 'work', 'work', 414)
on conflict (permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('CEO', 'FOUNDER', 'EXECUTIVE_DIRECTOR', 'SCHOOL_LEADER', 'HR', 'TEACHER')
  and p.permission_key in ('work.view', 'work.manage')
on conflict do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('CEO', 'FOUNDER', 'EXECUTIVE_DIRECTOR', 'SCHOOL_LEADER')
  and p.permission_key in ('work.admin', 'work.reports', 'work.executive')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 11. Seed system playbooks
-- ---------------------------------------------------------------------------

insert into public.work_playbooks (school_id, playbook_key, name, description, project_type, category, is_system, estimated_duration_days)
values
  (null, 'new_student_enrollment', 'New Student Enrollment', 'Complete enrollment workflow for new students', 'enrollment', 'student_services', true, 14),
  (null, 'teacher_hiring', 'Teacher Hiring', 'Recruit, interview, and hire instructional staff', 'hiring', 'hr', true, 45),
  (null, 'employee_onboarding', 'Employee Onboarding', 'Onboard new employees', 'onboarding', 'hr', true, 30),
  (null, 'iep_annual_review', 'IEP Annual Review', 'Annual IEP review process', 'special_education', 'student_services', true, 60),
  (null, '504_review', '504 Review', '504 plan review workflow', 'special_education', 'student_services', true, 45),
  (null, 'grant_award', 'Grant Award', 'Grant award acceptance and setup', 'grant', 'finance', true, 30),
  (null, 'state_funding_renewal', 'State Funding Renewal', 'Renew state funding documentation', 'state_funding', 'finance', true, 45),
  (null, 'annual_audit', 'Annual Audit', 'Prepare for annual financial audit', 'finance', 'finance', true, 90),
  (null, 'board_meeting', 'Board Meeting', 'Board meeting preparation cycle', 'board', 'governance', true, 21),
  (null, 'accreditation_visit', 'Accreditation Visit', 'Prepare for accreditation site visit', 'accreditation', 'compliance', true, 120),
  (null, 'new_school_opening', 'New School Opening', 'Launch a new school location', 'capital_project', 'operations', true, 365)
on conflict (school_id, playbook_key) do nothing;

insert into public.work_playbook_steps (playbook_id, step_order, title, task_type, offset_days, default_priority, requires_approval, creates_compliance)
select pb.id, s.step_order, s.title, s.task_type, s.offset_days, s.default_priority, s.requires_approval, s.creates_compliance
from public.work_playbooks pb
cross join lateral (values
  ('new_student_enrollment', 1, 'Collect enrollment documents', 'document', 0, 'high', false, false),
  ('new_student_enrollment', 2, 'Verify immunization records', 'compliance', 3, 'high', false, true),
  ('new_student_enrollment', 3, 'Schedule orientation meeting', 'meeting', 7, 'normal', false, false),
  ('new_student_enrollment', 4, 'Complete tuition setup', 'task', 10, 'normal', false, false),
  ('teacher_hiring', 1, 'Post job opening', 'task', 0, 'normal', false, false),
  ('teacher_hiring', 2, 'Screen candidates', 'task', 7, 'normal', false, false),
  ('teacher_hiring', 3, 'Conduct interviews', 'meeting', 14, 'high', false, false),
  ('teacher_hiring', 4, 'Extend offer', 'approval', 21, 'high', true, false),
  ('iep_annual_review', 1, 'Schedule IEP meeting', 'meeting', 0, 'high', false, false),
  ('iep_annual_review', 2, 'Collect progress data', 'task', 7, 'high', false, false),
  ('iep_annual_review', 3, 'Draft IEP document', 'document', 14, 'critical', false, true),
  ('iep_annual_review', 4, 'Obtain parent signatures', 'approval', 21, 'high', true, false)
) as s(playbook_key, step_order, title, task_type, offset_days, default_priority, requires_approval, creates_compliance)
where pb.playbook_key = s.playbook_key
  and not exists (
    select 1 from public.work_playbook_steps existing where existing.playbook_id = pb.id
  );
