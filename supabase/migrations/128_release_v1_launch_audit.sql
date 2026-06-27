-- =========================================
-- RELEASE V1.0: Platform audit findings storage
-- Extends Certification Center — not a new operational module
-- =========================================

create table if not exists public.cert_platform_audit_findings (
  id uuid primary key default gen_random_uuid(),
  audit_run_id uuid references public.cert_runs(id) on delete cascade,
  finding_key text not null,
  category text not null
    check (category in (
      'critical','high','medium','low','technical_debt',
      'performance','security','ui','accessibility'
    )),
  domain text not null,
  title text not null,
  description text not null,
  recommendation text,
  file_path text,
  status text not null default 'open'
    check (status in ('open','mitigated','accepted','wont_fix')),
  created_at timestamptz not null default now()
);

create index if not exists idx_cert_platform_audit_category on public.cert_platform_audit_findings(category, status);
create index if not exists idx_cert_platform_audit_run on public.cert_platform_audit_findings(audit_run_id);

alter table public.cert_platform_audit_findings enable row level security;

drop policy if exists cert_platform_audit_read on public.cert_platform_audit_findings;
create policy cert_platform_audit_read on public.cert_platform_audit_findings
  for select to authenticated
  using (has_permission('certification.view') or has_permission('certification.admin'));

drop policy if exists cert_platform_audit_write on public.cert_platform_audit_findings;
create policy cert_platform_audit_write on public.cert_platform_audit_findings
  for all to authenticated
  using (has_permission('certification.manage') or has_permission('certification.admin'))
  with check (has_permission('certification.manage') or has_permission('certification.admin'));

-- Performance indexes for launch-critical query paths
create index if not exists idx_mission_control_unresolved on public.platform_mission_control_items(is_resolved, created_at desc) where is_resolved = false;
create index if not exists idx_cert_readiness_org_date on public.cert_readiness_snapshots(organization_id, snapshot_date desc);
