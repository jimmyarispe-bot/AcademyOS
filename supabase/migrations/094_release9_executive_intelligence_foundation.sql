-- =========================================
-- RELEASE 9: EXECUTIVE INTELLIGENCE & DECISION SUPPORT
-- Reporting layer + executive workspace — idempotent
-- Does NOT duplicate operational data
-- =========================================

-- ---------------------------------------------------------------------------
-- 1. KPI definitions & historical snapshots
-- ---------------------------------------------------------------------------

create table if not exists public.executive_kpi_definitions (
  id uuid primary key default gen_random_uuid(),
  kpi_key text not null unique,
  display_name text not null,
  category text not null default 'general'
    check (category in (
      'enrollment', 'retention', 'academic', 'attendance', 'engagement',
      'financial', 'workforce', 'compliance', 'grants', 'strategic'
    )),
  unit text not null default 'number'
    check (unit in ('number', 'percent', 'currency', 'ratio', 'days')),
  target_value numeric(14, 4),
  warning_threshold numeric(14, 4),
  critical_threshold numeric(14, 4),
  higher_is_better boolean not null default true,
  data_source text not null default 'computed',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.executive_kpi_snapshots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete set null,
  program text,
  kpi_key text not null references public.executive_kpi_definitions(kpi_key) on delete cascade,
  snapshot_date date not null,
  actual_value numeric(14, 4) not null,
  target_value numeric(14, 4),
  prior_period_value numeric(14, 4),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (school_id, campus_id, program, kpi_key, snapshot_date)
);

create index if not exists idx_executive_kpi_snapshots_lookup
  on public.executive_kpi_snapshots(school_id, kpi_key, snapshot_date desc);

-- ---------------------------------------------------------------------------
-- 2. Customizable executive dashboard layouts
-- ---------------------------------------------------------------------------

create table if not exists public.executive_dashboard_layouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  layout_name text not null default 'default',
  role_scope text,
  widgets jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, layout_name)
);

drop trigger if exists executive_dashboard_layouts_set_updated_at on public.executive_dashboard_layouts;
create trigger executive_dashboard_layouts_set_updated_at
  before update on public.executive_dashboard_layouts
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Alert & insight engine
-- ---------------------------------------------------------------------------

create table if not exists public.executive_insights (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  insight_type text not null
    check (insight_type in (
      'trend', 'threshold', 'forecast', 'risk', 'benchmark', 'recommendation'
    )),
  severity text not null default 'info'
    check (severity in ('info', 'normal', 'warning', 'critical')),
  title text not null,
  body text not null,
  metric_key text,
  metric_value numeric(14, 4),
  comparison_value numeric(14, 4),
  recommended_action text,
  href text,
  entity_type text,
  entity_id uuid,
  is_dismissed boolean not null default false,
  dismissed_by uuid references public.users(id) on delete set null,
  dismissed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_executive_insights_school
  on public.executive_insights(school_id, is_dismissed, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Risk intelligence register
-- ---------------------------------------------------------------------------

create table if not exists public.executive_risk_register (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  risk_category text not null
    check (risk_category in (
      'student', 'family_financial', 'program_capacity', 'staffing',
      'compliance', 'revenue', 'funding', 'grant', 'operational', 'strategic'
    )),
  title text not null,
  description text,
  risk_score numeric(5, 2) not null default 50 check (risk_score >= 0 and risk_score <= 100),
  likelihood text not null default 'medium'
    check (likelihood in ('low', 'medium', 'high', 'critical')),
  impact text not null default 'medium'
    check (impact in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'monitoring', 'mitigated', 'closed')),
  recommended_action text,
  owner_user_id uuid references public.users(id) on delete set null,
  entity_type text,
  entity_id uuid,
  due_date date,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_executive_risk_register_school
  on public.executive_risk_register(school_id, status, risk_score desc);

drop trigger if exists executive_risk_register_set_updated_at on public.executive_risk_register;
create trigger executive_risk_register_set_updated_at
  before update on public.executive_risk_register
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Strategic planning workspace
-- ---------------------------------------------------------------------------

create table if not exists public.executive_strategic_goals (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  title text not null,
  description text,
  goal_type text not null default 'organizational'
    check (goal_type in ('organizational', 'academic', 'financial', 'operational', 'growth')),
  owner_user_id uuid references public.users(id) on delete set null,
  target_date date,
  status text not null default 'active'
    check (status in ('draft', 'active', 'completed', 'cancelled')),
  linked_kpi_key text references public.executive_kpi_definitions(kpi_key) on delete set null,
  progress_pct numeric(5, 2) not null default 0 check (progress_pct >= 0 and progress_pct <= 100),
  budget_amount numeric(14, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.executive_strategic_initiatives (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.executive_strategic_goals(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  title text not null,
  description text,
  owner_user_id uuid references public.users(id) on delete set null,
  budget_amount numeric(14, 2),
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'completed', 'on_hold', 'cancelled')),
  progress_pct numeric(5, 2) not null default 0,
  start_date date,
  end_date date,
  linked_kpi_key text references public.executive_kpi_definitions(kpi_key) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.executive_strategic_milestones (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references public.executive_strategic_initiatives(id) on delete cascade,
  title text not null,
  due_date date,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'overdue', 'cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

drop trigger if exists executive_strategic_goals_set_updated_at on public.executive_strategic_goals;
create trigger executive_strategic_goals_set_updated_at
  before update on public.executive_strategic_goals
  for each row execute function public.trigger_set_updated_at();

drop trigger if exists executive_strategic_initiatives_set_updated_at on public.executive_strategic_initiatives;
create trigger executive_strategic_initiatives_set_updated_at
  before update on public.executive_strategic_initiatives
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Accreditation & compliance center
-- ---------------------------------------------------------------------------

create table if not exists public.executive_compliance_requirements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  requirement_type text not null
    check (requirement_type in (
      'state_approval', 'accreditation', 'special_education', 'financial_audit',
      'hr_compliance', 'safety', 'ferpa', 'other'
    )),
  title text not null,
  description text,
  regulatory_body text,
  due_date date,
  renewal_date date,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'compliant', 'overdue', 'expired')),
  evidence_path text,
  owner_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists executive_compliance_requirements_set_updated_at on public.executive_compliance_requirements;
create trigger executive_compliance_requirements_set_updated_at
  before update on public.executive_compliance_requirements
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Grant & development dashboard
-- ---------------------------------------------------------------------------

create table if not exists public.executive_grants (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  grant_name text not null,
  funder_name text,
  pipeline_stage text not null default 'prospect'
    check (pipeline_stage in (
      'prospect', 'applied', 'awarded', 'active', 'reporting', 'closed', 'declined'
    )),
  award_amount numeric(14, 2),
  spent_amount numeric(14, 2) not null default 0,
  restricted_fund boolean not null default true,
  reporting_deadline date,
  campaign_name text,
  donor_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists executive_grants_set_updated_at on public.executive_grants;
create trigger executive_grants_set_updated_at
  before update on public.executive_grants
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. Reporting studio
-- ---------------------------------------------------------------------------

create table if not exists public.executive_report_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  name text not null,
  description text,
  report_type text not null default 'custom'
    check (report_type in ('board', 'kpi', 'financial', 'enrollment', 'custom')),
  config jsonb not null default '{}'::jsonb,
  export_formats text[] not null default array['csv'],
  schedule_cron text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.executive_report_runs (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.executive_report_templates(id) on delete set null,
  school_id uuid references public.schools(id) on delete cascade,
  run_by uuid references public.users(id) on delete set null,
  export_format text not null default 'csv',
  storage_path text,
  status text not null default 'completed'
    check (status in ('pending', 'completed', 'failed')),
  row_count integer,
  created_at timestamptz not null default now()
);

drop trigger if exists executive_report_templates_set_updated_at on public.executive_report_templates;
create trigger executive_report_templates_set_updated_at
  before update on public.executive_report_templates
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. Forecasting scenarios
-- ---------------------------------------------------------------------------

create table if not exists public.executive_forecast_scenarios (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  scenario_name text not null,
  scenario_type text not null default 'baseline'
    check (scenario_type in ('baseline', 'optimistic', 'pessimistic', 'custom')),
  assumptions jsonb not null default '{}'::jsonb,
  forecast_enrollment integer,
  forecast_tuition numeric(14, 2),
  forecast_scholarships numeric(14, 2),
  forecast_state_funding numeric(14, 2),
  forecast_payroll numeric(14, 2),
  forecast_staffing integer,
  forecast_capacity integer,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists executive_forecast_scenarios_set_updated_at on public.executive_forecast_scenarios;
create trigger executive_forecast_scenarios_set_updated_at
  before update on public.executive_forecast_scenarios
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 10. Read-only reporting views (data warehouse layer)
-- ---------------------------------------------------------------------------

create or replace view public.rpt_enrollment_summary as
select
  s.school_id,
  sch.name as school_name,
  s.campus_id,
  c.name as campus_name,
  s.program,
  s.grade_level,
  count(*) filter (where s.status = 'active') as active_students,
  count(*) filter (where s.status = 'inactive') as inactive_students,
  count(*) as total_students
from public.students s
join public.schools sch on sch.id = s.school_id
left join public.campuses c on c.id = s.campus_id
group by s.school_id, sch.name, s.campus_id, c.name, s.program, s.grade_level;

create or replace view public.rpt_admissions_pipeline as
select
  al.school_id,
  sch.name as school_name,
  al.lead_stage,
  al.program,
  count(*) as lead_count
from public.admissions_leads al
join public.schools sch on sch.id = al.school_id
where al.lead_stage not in ('enrolled', 'lost', 'withdrawn')
group by al.school_id, sch.name, al.lead_stage, al.program;

create or replace view public.rpt_financial_kpis as
select
  fba.school_id,
  sch.name as school_name,
  inv.program,
  sum(inv.total_amount) as total_billed,
  sum(inv.amount_paid) as total_collected,
  sum(inv.total_amount - inv.amount_paid) filter (where inv.invoice_status not in ('paid', 'void')) as outstanding_ar,
  sum(coalesce(inv.scholarship_credit, 0)) as scholarships_applied,
  sum(coalesce(inv.state_funding_credit, 0)) as state_funding_applied,
  count(*) as invoice_count
from public.invoices inv
join public.family_billing_accounts fba on fba.id = inv.billing_account_id
join public.schools sch on sch.id = fba.school_id
group by fba.school_id, sch.name, inv.program;

create or replace view public.rpt_student_outcomes as
select
  s.school_id,
  sch.name as school_name,
  s.campus_id,
  c.name as campus_name,
  s.program,
  s.grade_level,
  avg(sc.overall_score) as avg_success_score,
  count(distinct sc.student_id) as scored_students,
  count(distinct ar.student_id) filter (where ar.status in ('present', 'tardy')) as attendance_present,
  count(distinct ar.student_id) as attendance_total
from public.students s
join public.schools sch on sch.id = s.school_id
left join public.campuses c on c.id = s.campus_id
left join lateral (
  select student_id, overall_score
  from public.ssis_student_success_scores
  where student_id = s.id
  order by computed_at desc
  limit 1
) sc on true
left join public.student_attendance_records ar
  on ar.student_id = s.id
  and ar.attendance_date >= (current_date - interval '30 days')
where s.status = 'active'
group by s.school_id, sch.name, s.campus_id, c.name, s.program, s.grade_level;

create or replace view public.rpt_workforce_kpis as
select
  e.school_id,
  sch.name as school_name,
  e.department,
  e.program,
  e.employee_type,
  count(*) filter (where e.employment_status = 'active') as active_staff,
  count(*) filter (where e.employment_status = 'terminated') as terminated_staff
from public.employees e
join public.schools sch on sch.id = e.school_id
group by e.school_id, sch.name, e.department, e.program, e.employee_type;

-- ---------------------------------------------------------------------------
-- 11. Permissions & default KPI seeds
-- ---------------------------------------------------------------------------

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order)
values
  ('executive.intelligence', 'Executive Intelligence', 'Access executive decision support platform', 'executive', 'intelligence', 300),
  ('executive.board_reports', 'Board Reporting', 'Generate and export board-ready reports', 'executive', 'intelligence', 301),
  ('executive.strategic', 'Strategic Planning', 'Manage strategic goals and initiatives', 'executive', 'intelligence', 302),
  ('executive.risk_view', 'Risk Intelligence', 'View executive risk register', 'executive', 'intelligence', 303)
on conflict (permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('CEO', 'FOUNDER', 'EXECUTIVE_DIRECTOR', 'BOARD_MEMBER')
  and p.permission_key in ('executive.intelligence', 'executive.board_reports', 'executive.strategic', 'executive.risk_view')
on conflict do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name = 'SCHOOL_LEADER'
  and p.permission_key in ('executive.intelligence', 'executive.risk_view')
on conflict do nothing;

insert into public.executive_kpi_definitions (kpi_key, display_name, category, unit, target_value, warning_threshold, critical_threshold, higher_is_better, sort_order)
values
  ('enrollment_growth', 'Enrollment Growth', 'enrollment', 'percent', 5, 2, 0, true, 10),
  ('student_retention', 'Student Retention', 'retention', 'percent', 95, 90, 85, true, 20),
  ('attendance_rate', 'Attendance Rate', 'attendance', 'percent', 95, 90, 85, true, 30),
  ('avg_success_score', 'Student Success Score', 'academic', 'number', 80, 70, 60, true, 40),
  ('reading_growth', 'Reading Growth', 'academic', 'percent', 10, 5, 0, true, 50),
  ('parent_engagement', 'Parent Engagement', 'engagement', 'percent', 75, 60, 50, true, 60),
  ('staff_retention', 'Staff Retention', 'workforce', 'percent', 90, 85, 80, true, 70),
  ('collection_rate', 'Collection Rate', 'financial', 'percent', 95, 85, 75, true, 80),
  ('operating_margin', 'Operating Margin', 'financial', 'percent', 15, 10, 5, true, 90),
  ('grant_utilization', 'Grant Utilization', 'grants', 'percent', 90, 75, 60, true, 100)
on conflict (kpi_key) do nothing;

-- AI readiness metadata column (no AI implementation)
comment on table public.executive_insights is 'Executive insight engine — architecture ready for future AI narrative generation';
comment on view public.rpt_enrollment_summary is 'Read-only reporting view — optimized for executive analytics';
