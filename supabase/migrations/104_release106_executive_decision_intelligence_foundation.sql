-- =========================================
-- RELEASE 10.6: EXECUTIVE DECISION INTELLIGENCE (EDI)
-- Rules-based decision support — NOT AI
-- Extends Executive + Financial Intelligence
-- =========================================

-- ---------------------------------------------------------------------------
-- 1. Recommendations (decision cards)
-- ---------------------------------------------------------------------------

create table if not exists public.edi_recommendations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  domain text not null
    check (domain in (
      'class','program','teacher','scheduling','financial','enrollment',
      'student_success','capacity','strategic'
    )),
  recommendation_type text not null,
  entity_type text,
  entity_id uuid,
  entity_key text,
  issue text not null,
  evidence text,
  what_happened text,
  why_happened text,
  likely_next text,
  supporting_metrics jsonb not null default '{}'::jsonb,
  financial_impact numeric(14,2) not null default 0,
  operational_impact numeric(14,2) not null default 0,
  student_success_impact numeric(14,2) not null default 0,
  impact_details jsonb not null default '{}'::jsonb,
  risk_level text not null default 'medium'
    check (risk_level in ('low','medium','high','critical')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','critical')),
  confidence_score numeric(5,2) not null default 70
    check (confidence_score >= 0 and confidence_score <= 100),
  recommendation_score numeric(8,2) not null default 0,
  estimated_timeline text,
  recommended_action text not null,
  alternative_options jsonb not null default '[]'::jsonb,
  decision_owner_role text,
  approval_status text not null default 'pending'
    check (approval_status in ('pending','approved','rejected','deferred','superseded')),
  current_margin numeric(14,2),
  target_margin numeric(14,2),
  projected_margin numeric(14,2),
  break_even_enrollment numeric(8,2),
  recommended_enrollment numeric(8,2),
  status text not null default 'active'
    check (status in ('active','accepted','rejected','deferred','superseded','expired')),
  mission_control_item_id uuid,
  expires_at timestamptz,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, domain, recommendation_type, entity_type, entity_id, entity_key)
);

create index if not exists idx_edi_recommendations_school on public.edi_recommendations(school_id, status, priority, recommendation_score desc);
create index if not exists idx_edi_recommendations_domain on public.edi_recommendations(school_id, domain, computed_at desc);

-- ---------------------------------------------------------------------------
-- 2. Decision history & outcome tracking
-- ---------------------------------------------------------------------------

create table if not exists public.edi_decision_history (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  recommendation_id uuid references public.edi_recommendations(id) on delete set null,
  decision_made text not null,
  approved_by uuid references public.users(id) on delete set null,
  reason text,
  outcome_status text not null default 'pending'
    check (outcome_status in ('pending','in_progress','achieved','partial','failed','cancelled')),
  projected_financial_impact numeric(14,2),
  actual_financial_impact numeric(14,2),
  projected_enrollment_impact numeric(8,2),
  actual_enrollment_impact numeric(8,2),
  projected_student_success_impact numeric(8,2),
  actual_student_success_impact numeric(8,2),
  lessons_learned text,
  metadata jsonb not null default '{}'::jsonb,
  decided_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_edi_decision_history_school on public.edi_decision_history(school_id, decided_at desc);

-- ---------------------------------------------------------------------------
-- 3. Scenario comparison (EDI — distinct from FI scenarios)
-- ---------------------------------------------------------------------------

create table if not exists public.edi_scenarios (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  scenario_group text not null default 'comparison',
  name text not null,
  description text,
  scenario_type text not null default 'custom'
    check (scenario_type in (
      'tuition_increase','tuition_decrease','hire_teacher','increase_class_size',
      'open_section','close_section','lease_building','expand_campus','custom'
    )),
  inputs jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','computed','archived')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.edi_scenario_results (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.edi_scenarios(id) on delete cascade,
  projected_revenue numeric(14,2) not null default 0,
  projected_expenses numeric(14,2) not null default 0,
  projected_enrollment numeric(8,2),
  projected_ebitda numeric(14,2) not null default 0,
  projected_cash_flow numeric(14,2) not null default 0,
  projected_margin_pct numeric(8,4) not null default 0,
  operational_impact jsonb not null default '{}'::jsonb,
  student_success_impact jsonb not null default '{}'::jsonb,
  delta_summary jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Capacity planning snapshots
-- ---------------------------------------------------------------------------

create table if not exists public.edi_capacity_snapshots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  snapshot_date date not null default current_date,
  available_seats integer not null default 0,
  used_seats integer not null default 0,
  teacher_utilization_pct numeric(8,2) not null default 0,
  room_utilization_pct numeric(8,2) not null default 0,
  schedule_utilization_pct numeric(8,2) not null default 0,
  campus_utilization_pct numeric(8,2) not null default 0,
  program_utilization_pct numeric(8,2) not null default 0,
  virtual_capacity_hours numeric(10,2) not null default 0,
  future_capacity_seats integer,
  projected_shortages jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (school_id, snapshot_date)
);

-- ---------------------------------------------------------------------------
-- 5. Executive briefings
-- ---------------------------------------------------------------------------

create table if not exists public.edi_briefings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  briefing_type text not null
    check (briefing_type in (
      'daily','weekly','risks','opportunities','roi_programs','staffing',
      'enrollment','financial','board_summary'
    )),
  title text not null,
  summary text,
  content jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_edi_briefings_school on public.edi_briefings(school_id, briefing_type, generated_at desc);

-- ---------------------------------------------------------------------------
-- 6. Executive scorecard
-- ---------------------------------------------------------------------------

create table if not exists public.edi_scorecard_snapshots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  snapshot_date date not null default current_date,
  financial_health numeric(5,2) not null default 0,
  enrollment_health numeric(5,2) not null default 0,
  student_success numeric(5,2) not null default 0,
  teacher_effectiveness numeric(5,2) not null default 0,
  compliance numeric(5,2) not null default 0,
  growth numeric(5,2) not null default 0,
  parent_engagement numeric(5,2) not null default 0,
  operational_efficiency numeric(5,2) not null default 0,
  capacity numeric(5,2) not null default 0,
  risk numeric(5,2) not null default 0,
  overall_enterprise_health numeric(5,2) not null default 0,
  dimensions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (school_id, snapshot_date)
);

-- ---------------------------------------------------------------------------
-- 7. Educational ROI
-- ---------------------------------------------------------------------------

create table if not exists public.edi_educational_roi (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  entity_type text not null
    check (entity_type in ('teacher','class','program','intervention','therapy','funding_source')),
  entity_id uuid,
  entity_key text,
  financial_roi numeric(8,4) not null default 0,
  student_growth numeric(8,4),
  attendance_improvement numeric(8,4),
  behavior_improvement numeric(8,4),
  goal_achievement numeric(8,4),
  parent_engagement numeric(8,4),
  retention numeric(8,4),
  overall_educational_roi numeric(8,4) not null default 0,
  methodology jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  unique (school_id, entity_type, entity_id, entity_key)
);

-- ---------------------------------------------------------------------------
-- 8. Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists edi_recommendations_set_updated_at on public.edi_recommendations;
create trigger edi_recommendations_set_updated_at
  before update on public.edi_recommendations
  for each row execute function public.trigger_set_updated_at();

drop trigger if exists edi_scenarios_set_updated_at on public.edi_scenarios;
create trigger edi_scenarios_set_updated_at
  before update on public.edi_scenarios
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. Reporting views
-- ---------------------------------------------------------------------------

create or replace view public.rpt_edi_recommendations as
select
  r.id,
  r.school_id,
  sch.name as school_name,
  r.domain,
  r.recommendation_type,
  r.entity_type,
  r.entity_id,
  r.entity_key,
  r.issue,
  r.recommended_action,
  r.financial_impact,
  r.operational_impact,
  r.student_success_impact,
  r.risk_level,
  r.priority,
  r.confidence_score,
  r.recommendation_score,
  r.approval_status,
  r.status,
  r.computed_at
from public.edi_recommendations r
left join public.schools sch on sch.id = r.school_id
where r.status = 'active';

create or replace view public.rpt_edi_scorecard as
select
  s.school_id,
  sch.name as school_name,
  s.snapshot_date,
  s.financial_health,
  s.enrollment_health,
  s.student_success,
  s.teacher_effectiveness,
  s.compliance,
  s.growth,
  s.parent_engagement,
  s.operational_efficiency,
  s.capacity,
  s.risk,
  s.overall_enterprise_health
from public.edi_scorecard_snapshots s
left join public.schools sch on sch.id = s.school_id;

create or replace view public.rpt_edi_capacity as
select
  c.school_id,
  sch.name as school_name,
  c.snapshot_date,
  c.available_seats,
  c.used_seats,
  c.teacher_utilization_pct,
  c.room_utilization_pct,
  c.schedule_utilization_pct,
  c.campus_utilization_pct,
  c.program_utilization_pct,
  c.future_capacity_seats,
  c.projected_shortages
from public.edi_capacity_snapshots c
left join public.schools sch on sch.id = c.school_id;

grant select on public.rpt_edi_recommendations to authenticated;
grant select on public.rpt_edi_scorecard to authenticated;
grant select on public.rpt_edi_capacity to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Permissions
-- ---------------------------------------------------------------------------

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order)
values
  ('edi.view', 'Executive Decision Intelligence View', 'View decision recommendations and briefings', 'executive', 'decision_intelligence', 430),
  ('edi.manage', 'Executive Decision Intelligence Manage', 'Record decisions and manage recommendations', 'executive', 'decision_intelligence', 431),
  ('edi.executive', 'Executive Decision Intelligence Executive', 'Full EDI workspace and optimization engines', 'executive', 'decision_intelligence', 432),
  ('edi.board', 'Executive Decision Intelligence Board', 'Board reports and strategic briefings', 'executive', 'decision_intelligence', 433)
on conflict (permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('CEO', 'FOUNDER', 'EXECUTIVE_DIRECTOR', 'SCHOOL_LEADER')
  and p.permission_key in ('edi.view', 'edi.executive')
on conflict do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('CEO', 'FOUNDER', 'EXECUTIVE_DIRECTOR')
  and p.permission_key in ('edi.manage', 'edi.board')
on conflict do nothing;
