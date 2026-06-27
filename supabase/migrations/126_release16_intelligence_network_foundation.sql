-- =========================================
-- RELEASE 16: AcademyOS Intelligence Network (AIN)
-- Federated anonymized benchmarking — opt-in, privacy-preserving
-- Extends AcademyOS — backward compatible
-- =========================================

create table if not exists public.ain_participation_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade unique,
  participation_status text not null default 'opt_out'
    check (participation_status in ('opt_in','opt_out','selective')),
  anonymization_level text not null default 'standard'
    check (anonymization_level in ('standard','enhanced','minimal')),
  share_regional boolean not null default true,
  share_national boolean not null default true,
  share_international boolean not null default false,
  data_categories jsonb not null default '["academic","financial","staffing","enrollment","compliance","operations"]'::jsonb,
  peer_segments jsonb not null default '["similar_enrollment","private"]'::jsonb,
  consent_at timestamptz,
  consent_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ain_contributions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  contribution_period date not null default current_date,
  segment_key text not null default 'private',
  metric_category text not null
    check (metric_category in ('academic','financial','staffing','enrollment','compliance','operations')),
  metrics jsonb not null default '{}'::jsonb,
  anonymized_hash text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, contribution_period, segment_key, metric_category)
);

create table if not exists public.ain_benchmark_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  benchmark_scope text not null default 'national'
    check (benchmark_scope in ('regional','national','international','peer')),
  segment_key text not null,
  metric_category text not null,
  metric_key text not null,
  peer_count integer not null default 0,
  percentile_25 numeric(12,4),
  percentile_50 numeric(12,4),
  percentile_75 numeric(12,4),
  percentile_90 numeric(12,4),
  mean_value numeric(12,4),
  created_at timestamptz not null default now(),
  unique (snapshot_date, benchmark_scope, segment_key, metric_category, metric_key)
);

create table if not exists public.ain_research_reports (
  id uuid primary key default gen_random_uuid(),
  report_key text not null unique,
  report_title text not null,
  report_category text not null
    check (report_category in ('interventions','staffing','financial','academic','service_delivery')),
  summary text,
  findings jsonb not null default '{}'::jsonb,
  peer_organizations_count integer not null default 0,
  published_at timestamptz not null default now()
);

create table if not exists public.ain_forecasts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  forecast_date date not null default current_date,
  forecast_type text not null
    check (forecast_type in ('enrollment','revenue','staffing','cash_flow','capacity','compliance_risk','intervention_demand')),
  horizon_months integer not null default 12,
  projections jsonb not null default '{}'::jsonb,
  confidence_pct numeric(5,2) not null default 75,
  created_at timestamptz not null default now(),
  unique (organization_id, forecast_date, forecast_type)
);

create table if not exists public.ain_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  recommendation_key text not null,
  category text not null,
  title text not null,
  description text,
  priority text not null default 'normal'
    check (priority in ('low','normal','high')),
  rule_basis text,
  status text not null default 'active'
    check (status in ('active','dismissed','applied')),
  created_at timestamptz not null default now(),
  unique (organization_id, recommendation_key)
);

create table if not exists public.ain_executive_rankings (
  id uuid primary key default gen_random_uuid(),
  ranking_date date not null default current_date,
  ranking_type text not null
    check (ranking_type in ('top_performing','fastest_growing','academic_growth','profitability','operational_excellence','compliance_leaders')),
  scope text not null default 'national',
  rankings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (ranking_date, ranking_type, scope)
);

create table if not exists public.ain_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.org_organizations(id) on delete set null,
  action_type text not null,
  details jsonb not null default '{}'::jsonb,
  actor_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ain_contributions_period on public.ain_contributions(contribution_period, metric_category);
create index if not exists idx_ain_benchmarks_lookup on public.ain_benchmark_snapshots(snapshot_date, segment_key, metric_category);

-- Seed research reports (anonymized aggregate findings)
insert into public.ain_research_reports (report_key, report_title, report_category, summary, findings, peer_organizations_count)
values
  ('intervention_reading_2026', 'Most Effective Reading Interventions', 'interventions',
   'Anonymized analysis across participating schools',
   '{"top_interventions":["structured_literacy","small_group_tutoring","MAP_targeted"],"effect_size_median":0.42}'::jsonb, 128),
  ('staffing_models_2026', 'Successful Staffing Models', 'staffing',
   'Caseload and ratio benchmarks for special education',
   '{"optimal_sped_ratio":12,"co_teaching_adoption_pct":34}'::jsonb, 96),
  ('financial_sustainability_2026', 'Financial Sustainability Trends', 'financial',
   'Revenue per student and margin trends',
   '{"median_revenue_per_student":12400,"median_operating_margin_pct":8.2}'::jsonb, 210),
  ('academic_correlations_2026', 'Academic Outcome Correlations', 'academic',
   'Attendance and intervention correlation with growth',
   '{"attendance_growth_correlation":0.67}'::jsonb, 185),
  ('service_delivery_2026', 'Service Delivery Effectiveness', 'service_delivery',
   'Therapy and related service delivery benchmarks',
   '{"session_completion_rate_median":92}'::jsonb, 74)
on conflict (report_key) do nothing;

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order)
values
  ('network.view', 'Intelligence Network View', 'View anonymized benchmarks and network intelligence', 'network', 'intelligence_network', 950),
  ('network.manage', 'Intelligence Network Manage', 'Manage participation and sharing settings', 'network', 'intelligence_network', 951),
  ('network.admin', 'Intelligence Network Admin', 'Administer Intelligence Network', 'network', 'intelligence_network', 952)
on conflict (permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('CEO', 'FOUNDER', 'EXECUTIVE_DIRECTOR')
  and p.permission_key in ('network.view', 'network.manage', 'network.admin')
on conflict do nothing;
