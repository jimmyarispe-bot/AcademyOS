-- =========================================
-- ADMISSIONS SPRINT 1.5: RLS POLICIES
-- Idempotent: safe to re-run
-- =========================================

alter table public.school_admissions_settings enable row level security;
alter table public.admissions_checklist_template_items enable row level security;
alter table public.admissions_application_checklist_items enable row level security;
alter table public.funding_program_catalog enable row level security;
alter table public.state_funding_expected_payments enable row level security;
alter table public.state_funding_received_payments enable row level security;
alter table public.admissions_decisions enable row level security;
alter table public.admissions_communications enable row level security;
alter table public.enrollment_packet_templates enable row level security;
alter table public.enrollment_packets enable row level security;
alter table public.enrollment_packet_signatures enable row level security;

-- school_admissions_settings
drop policy if exists school_admissions_settings_staff on public.school_admissions_settings;
create policy school_admissions_settings_staff on public.school_admissions_settings
for all using (can_access_school(school_id)) with check (can_access_school(school_id));

-- checklist templates
drop policy if exists checklist_template_staff on public.admissions_checklist_template_items;
create policy checklist_template_staff on public.admissions_checklist_template_items
for all using (can_access_school(school_id)) with check (can_access_school(school_id));

-- application checklist
drop policy if exists application_checklist_staff on public.admissions_application_checklist_items;
create policy application_checklist_staff on public.admissions_application_checklist_items
for all using (
  can_access_school(school_id_for_admissions_application(application_id))
) with check (
  can_access_school(school_id_for_admissions_application(application_id))
);

drop policy if exists application_checklist_guardian on public.admissions_application_checklist_items;
create policy application_checklist_guardian on public.admissions_application_checklist_items
for select using (
  exists (
    select 1 from public.admissions_applications aa
    where aa.id = admissions_application_checklist_items.application_id
      and is_guardian_of_lead(aa.lead_id)
  )
);

-- funding program catalog (org-wide rows have null school_id — CEO/staff read)
drop policy if exists funding_program_catalog_read on public.funding_program_catalog;
create policy funding_program_catalog_read on public.funding_program_catalog
for select using (
  school_id is null
  or can_access_school(school_id)
);

drop policy if exists funding_program_catalog_write on public.funding_program_catalog;
create policy funding_program_catalog_write on public.funding_program_catalog
for all using (
  school_id is not null and can_access_school(school_id)
) with check (
  school_id is not null and can_access_school(school_id)
);

-- expected/received payments
drop policy if exists state_funding_expected_staff on public.state_funding_expected_payments;
create policy state_funding_expected_staff on public.state_funding_expected_payments
for all using (can_access_school(school_id)) with check (can_access_school(school_id));

drop policy if exists state_funding_received_staff on public.state_funding_received_payments;
create policy state_funding_received_staff on public.state_funding_received_payments
for all using (can_access_school(school_id)) with check (can_access_school(school_id));

-- decisions & communications (staff only)
drop policy if exists admissions_decisions_staff on public.admissions_decisions;
create policy admissions_decisions_staff on public.admissions_decisions
for all using (can_access_school(school_id_for_admission_lead(lead_id)))
with check (can_access_school(school_id_for_admission_lead(lead_id)));

drop policy if exists admissions_communications_staff on public.admissions_communications;
create policy admissions_communications_staff on public.admissions_communications
for all using (can_access_school(school_id_for_admission_lead(lead_id)))
with check (can_access_school(school_id_for_admission_lead(lead_id)));

drop policy if exists admissions_communications_guardian on public.admissions_communications;
create policy admissions_communications_guardian on public.admissions_communications
for select using (is_guardian_of_lead(lead_id));

-- enrollment packets
drop policy if exists enrollment_packet_templates_staff on public.enrollment_packet_templates;
create policy enrollment_packet_templates_staff on public.enrollment_packet_templates
for all using (can_access_school(school_id)) with check (can_access_school(school_id));

drop policy if exists enrollment_packets_staff on public.enrollment_packets;
create policy enrollment_packets_staff on public.enrollment_packets
for all using (can_access_school(school_id)) with check (can_access_school(school_id));

drop policy if exists enrollment_packets_guardian on public.enrollment_packets;
create policy enrollment_packets_guardian on public.enrollment_packets
for select using (is_guardian_of_lead(lead_id));

drop policy if exists enrollment_packet_signatures_staff on public.enrollment_packet_signatures;
create policy enrollment_packet_signatures_staff on public.enrollment_packet_signatures
for all using (
  exists (
    select 1 from public.enrollment_packets ep
    where ep.id = enrollment_packet_signatures.enrollment_packet_id
      and can_access_school(ep.school_id)
  )
) with check (
  exists (
    select 1 from public.enrollment_packets ep
    where ep.id = enrollment_packet_signatures.enrollment_packet_id
      and can_access_school(ep.school_id)
  )
);

drop policy if exists enrollment_packet_signatures_guardian on public.enrollment_packet_signatures;
create policy enrollment_packet_signatures_guardian on public.enrollment_packet_signatures
for insert with check (
  exists (
    select 1 from public.enrollment_packets ep
    where ep.id = enrollment_packet_signatures.enrollment_packet_id
      and is_guardian_of_lead(ep.lead_id)
  )
);

drop policy if exists enrollment_packet_signatures_guardian_select on public.enrollment_packet_signatures;
create policy enrollment_packet_signatures_guardian_select on public.enrollment_packet_signatures
for select using (
  exists (
    select 1 from public.enrollment_packets ep
    where ep.id = enrollment_packet_signatures.enrollment_packet_id
      and is_guardian_of_lead(ep.lead_id)
  )
);

-- grants
grant select, insert, update, delete on table public.school_admissions_settings to authenticated;
grant select, insert, update, delete on table public.admissions_checklist_template_items to authenticated;
grant select, insert, update, delete on table public.admissions_application_checklist_items to authenticated;
grant select, insert, update, delete on table public.funding_program_catalog to authenticated;
grant select, insert, update, delete on table public.state_funding_expected_payments to authenticated;
grant select, insert, update, delete on table public.state_funding_received_payments to authenticated;
grant select, insert, update, delete on table public.admissions_decisions to authenticated;
grant select, insert, update, delete on table public.admissions_communications to authenticated;
grant select, insert, update, delete on table public.enrollment_packet_templates to authenticated;
grant select, insert, update, delete on table public.enrollment_packets to authenticated;
grant select, insert, update, delete on table public.enrollment_packet_signatures to authenticated;

grant all on table public.school_admissions_settings to service_role;
grant all on table public.admissions_checklist_template_items to service_role;
grant all on table public.admissions_application_checklist_items to service_role;
grant all on table public.funding_program_catalog to service_role;
grant all on table public.state_funding_expected_payments to service_role;
grant all on table public.state_funding_received_payments to service_role;
grant all on table public.admissions_decisions to service_role;
grant all on table public.admissions_communications to service_role;
grant all on table public.enrollment_packet_templates to service_role;
grant all on table public.enrollment_packets to service_role;
grant all on table public.enrollment_packet_signatures to service_role;

notify pgrst, 'reload schema';
