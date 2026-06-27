-- =========================================
-- RELEASE 10.1 RLS: Enterprise Compliance
-- =========================================

alter table public.compliance_categories enable row level security;
alter table public.compliance_reminder_schedules enable row level security;
alter table public.compliance_escalation_rules enable row level security;
alter table public.compliance_obligation_templates enable row level security;
alter table public.compliance_obligations enable row level security;
alter table public.compliance_obligation_documents enable row level security;
alter table public.compliance_obligation_reminders enable row level security;
alter table public.compliance_obligation_escalations enable row level security;
alter table public.compliance_audit_log enable row level security;
alter table public.compliance_calendar_links enable row level security;
alter table public.compliance_domain_scores enable row level security;

drop policy if exists compliance_categories_read on public.compliance_categories;
create policy compliance_categories_read on public.compliance_categories
  for select to authenticated
  using (
    has_permission('compliance.view') or has_permission('compliance.manage')
    or has_permission('executive.intelligence')
  );

drop policy if exists compliance_categories_manage on public.compliance_categories;
create policy compliance_categories_manage on public.compliance_categories
  for all to authenticated
  using (has_permission('compliance.admin'))
  with check (has_permission('compliance.admin'));

drop policy if exists compliance_reminder_schedules_access on public.compliance_reminder_schedules;
create policy compliance_reminder_schedules_access on public.compliance_reminder_schedules
  for all to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (has_permission('compliance.view') or has_permission('compliance.admin'))
  )
  with check (
    (school_id is null or can_access_school(school_id))
    and has_permission('compliance.admin')
  );

drop policy if exists compliance_escalation_rules_access on public.compliance_escalation_rules;
create policy compliance_escalation_rules_access on public.compliance_escalation_rules
  for all to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (has_permission('compliance.view') or has_permission('compliance.admin'))
  )
  with check (
    (school_id is null or can_access_school(school_id))
    and has_permission('compliance.admin')
  );

drop policy if exists compliance_obligation_templates_access on public.compliance_obligation_templates;
create policy compliance_obligation_templates_access on public.compliance_obligation_templates
  for all to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (has_permission('compliance.view') or has_permission('compliance.manage'))
  )
  with check (
    (school_id is null or can_access_school(school_id))
    and has_permission('compliance.manage')
  );

drop policy if exists compliance_obligations_access on public.compliance_obligations;
create policy compliance_obligations_access on public.compliance_obligations
  for all to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (
      has_permission('compliance.view') or has_permission('compliance.manage')
      or owner_user_id = auth.uid() or backup_owner_user_id = auth.uid()
      or reviewer_user_id = auth.uid() or approver_user_id = auth.uid()
    )
  )
  with check (
    (school_id is null or can_access_school(school_id))
    and (
      has_permission('compliance.manage')
      or owner_user_id = auth.uid() or backup_owner_user_id = auth.uid()
    )
  );

drop policy if exists compliance_obligation_documents_access on public.compliance_obligation_documents;
create policy compliance_obligation_documents_access on public.compliance_obligation_documents
  for all to authenticated
  using (
    exists (
      select 1 from public.compliance_obligations o
      where o.id = obligation_id
        and (o.school_id is null or can_access_school(o.school_id))
        and (has_permission('compliance.view') or o.owner_user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.compliance_obligations o
      where o.id = obligation_id
        and (has_permission('compliance.manage') or o.owner_user_id = auth.uid())
    )
  );

drop policy if exists compliance_obligation_reminders_access on public.compliance_obligation_reminders;
create policy compliance_obligation_reminders_access on public.compliance_obligation_reminders
  for all to authenticated
  using (
    exists (
      select 1 from public.compliance_obligations o
      where o.id = obligation_id
        and (o.school_id is null or can_access_school(o.school_id))
        and has_permission('compliance.view')
    )
  );

drop policy if exists compliance_obligation_escalations_access on public.compliance_obligation_escalations;
create policy compliance_obligation_escalations_access on public.compliance_obligation_escalations
  for all to authenticated
  using (
    exists (
      select 1 from public.compliance_obligations o
      where o.id = obligation_id
        and (o.school_id is null or can_access_school(o.school_id))
        and has_permission('compliance.view')
    )
  );

drop policy if exists compliance_audit_log_read on public.compliance_audit_log;
create policy compliance_audit_log_read on public.compliance_audit_log
  for select to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and has_permission('compliance.view')
  );

drop policy if exists compliance_audit_log_insert on public.compliance_audit_log;
create policy compliance_audit_log_insert on public.compliance_audit_log
  for insert to authenticated
  with check (has_permission('compliance.manage') or has_permission('compliance.admin'));

drop policy if exists compliance_calendar_links_access on public.compliance_calendar_links;
create policy compliance_calendar_links_access on public.compliance_calendar_links
  for all to authenticated
  using (
    exists (
      select 1 from public.compliance_obligations o
      where o.id = obligation_id and (o.school_id is null or can_access_school(o.school_id))
    )
  );

drop policy if exists compliance_domain_scores_read on public.compliance_domain_scores;
create policy compliance_domain_scores_read on public.compliance_domain_scores
  for select to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (has_permission('compliance.view') or has_permission('executive.intelligence'))
  );

drop policy if exists compliance_domain_scores_manage on public.compliance_domain_scores;
create policy compliance_domain_scores_manage on public.compliance_domain_scores
  for all to authenticated
  using (has_permission('compliance.admin') or has_permission('executive.intelligence'))
  with check (has_permission('compliance.admin') or has_permission('executive.intelligence'));
