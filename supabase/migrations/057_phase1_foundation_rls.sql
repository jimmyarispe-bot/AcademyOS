-- =========================================
-- PHASE 1: FOUNDATION RLS POLICIES
-- RLS for new tables + update admissions policies
-- Idempotent: safe to re-run after partial apply
-- =========================================

-- Drop old prospect-named policies
drop policy if exists prospects_staff_all on public.admissions_leads;
drop policy if exists prospects_guardian_select on public.admissions_leads;
drop policy if exists prospect_guardians_staff_all on public.admissions_lead_guardians;
drop policy if exists prospect_guardians_guardian_select on public.admissions_lead_guardians;
drop policy if exists admissions_notes_staff_all on public.admissions_notes;
drop policy if exists admissions_tasks_staff_all on public.admissions_tasks;

-- ADMISSIONS LEADS
alter table public.admissions_leads enable row level security;

drop policy if exists admissions_leads_staff_all on public.admissions_leads;

create policy admissions_leads_staff_all
on public.admissions_leads
for all
using (can_access_school(school_id))
with check (can_access_school(school_id));

drop policy if exists admissions_leads_guardian_select on public.admissions_leads;

create policy admissions_leads_guardian_select
on public.admissions_leads
for select
using (is_guardian_of_lead(id));

-- LEAD GUARDIANS
alter table public.admissions_lead_guardians enable row level security;

drop policy if exists admissions_lead_guardians_staff_all on public.admissions_lead_guardians;

create policy admissions_lead_guardians_staff_all
on public.admissions_lead_guardians
for all
using (can_access_school(school_id_for_admission_lead(lead_id)))
with check (can_access_school(school_id_for_admission_lead(lead_id)));

drop policy if exists admissions_lead_guardians_guardian_select on public.admissions_lead_guardians;

create policy admissions_lead_guardians_guardian_select
on public.admissions_lead_guardians
for select
using (is_guardian_of_lead(lead_id));

-- ADMISSIONS TOURS
alter table public.admissions_tours enable row level security;

drop policy if exists admissions_tours_staff_all on public.admissions_tours;

create policy admissions_tours_staff_all
on public.admissions_tours
for all
using (can_access_school(school_id_for_admission_lead(lead_id)))
with check (can_access_school(school_id_for_admission_lead(lead_id)));

-- Update notes/tasks policies with lead_id
drop policy if exists admissions_notes_staff_all on public.admissions_notes;

create policy admissions_notes_staff_all
on public.admissions_notes
for all
using (can_access_school(school_id_for_admission_lead(lead_id)))
with check (can_access_school(school_id_for_admission_lead(lead_id)));

drop policy if exists admissions_tasks_staff_all on public.admissions_tasks;

create policy admissions_tasks_staff_all
on public.admissions_tasks
for all
using (can_access_school(school_id_for_admission_lead(lead_id)))
with check (can_access_school(school_id_for_admission_lead(lead_id)));

-- Update application policies (lead_id column)
drop policy if exists admin_full_access on public.admissions_applications;
drop policy if exists guardian_own_prospect_access on public.admissions_applications;
drop policy if exists admissions_applications_staff_all on public.admissions_applications;
drop policy if exists admissions_applications_guardian_select on public.admissions_applications;

create policy admissions_applications_staff_all
on public.admissions_applications
for all
using (can_access_school(school_id_for_admission_lead(lead_id)))
with check (can_access_school(school_id_for_admission_lead(lead_id)));

create policy admissions_applications_guardian_select
on public.admissions_applications
for select
using (is_guardian_of_lead(lead_id));

-- Update guardian policies on documents/scholarships
drop policy if exists application_documents_guardian_select on public.application_documents;

create policy application_documents_guardian_select
on public.application_documents
for select
using (
  exists (
    select 1
    from public.admissions_applications aa
    where aa.id = application_documents.application_id
      and is_guardian_of_lead(aa.lead_id)
  )
);

drop policy if exists scholarship_applications_guardian_select on public.scholarship_applications;

create policy scholarship_applications_guardian_select
on public.scholarship_applications
for select
using (
  exists (
    select 1
    from public.admissions_applications aa
    where aa.id = scholarship_applications.application_id
      and is_guardian_of_lead(aa.lead_id)
  )
);

drop policy if exists scholarship_documents_guardian_select on public.scholarship_documents;

create policy scholarship_documents_guardian_select
on public.scholarship_documents
for select
using (
  exists (
    select 1
    from public.scholarship_applications sa
    join public.admissions_applications aa on aa.id = sa.application_id
    where sa.id = scholarship_documents.scholarship_application_id
      and is_guardian_of_lead(aa.lead_id)
  )
);

-- FAMILIES
alter table public.families enable row level security;

drop policy if exists families_staff_all on public.families;

create policy families_staff_all
on public.families
for all
using (can_access_school(school_id))
with check (can_access_school(school_id));

-- GUARDIANS
alter table public.guardians enable row level security;

drop policy if exists guardians_staff_all on public.guardians;

create policy guardians_staff_all
on public.guardians
for all
using (can_access_school(school_id_for_family(family_id)))
with check (can_access_school(school_id_for_family(family_id)));

-- SIS ENROLLMENTS
alter table public.sis_enrollments enable row level security;

drop policy if exists sis_enrollments_staff_all on public.sis_enrollments;

create policy sis_enrollments_staff_all
on public.sis_enrollments
for all
using (can_access_school(school_id_for_student(student_id)))
with check (can_access_school(school_id_for_student(student_id)));

-- BILLING
alter table public.family_billing_accounts enable row level security;
alter table public.tuition_plans enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;

drop policy if exists family_billing_accounts_staff_all on public.family_billing_accounts;

create policy family_billing_accounts_staff_all
on public.family_billing_accounts
for all
using (can_access_school(school_id))
with check (can_access_school(school_id));

drop policy if exists tuition_plans_staff_all on public.tuition_plans;

create policy tuition_plans_staff_all
on public.tuition_plans
for all
using (can_access_school(school_id))
with check (can_access_school(school_id));

drop policy if exists invoices_staff_all on public.invoices;

create policy invoices_staff_all
on public.invoices
for all
using (can_access_school(school_id_for_billing_account(billing_account_id)))
with check (can_access_school(school_id_for_billing_account(billing_account_id)));

drop policy if exists payments_staff_all on public.payments;

create policy payments_staff_all
on public.payments
for all
using (
  can_access_school(
    school_id_for_billing_account(
      (select i.billing_account_id from public.invoices i where i.id = payments.invoice_id)
    )
  )
)
with check (
  can_access_school(
    school_id_for_billing_account(
      (select i.billing_account_id from public.invoices i where i.id = payments.invoice_id)
    )
  )
);

-- HR
alter table public.positions enable row level security;
alter table public.employee_positions enable row level security;
alter table public.employee_certifications enable row level security;
alter table public.payroll_records enable row level security;

drop policy if exists positions_staff_all on public.positions;

create policy positions_staff_all
on public.positions
for all
using (can_access_school(school_id))
with check (can_access_school(school_id));

drop policy if exists employee_positions_staff_all on public.employee_positions;

create policy employee_positions_staff_all
on public.employee_positions
for all
using (
  can_access_school(
    (select e.school_id from public.employees e where e.id = employee_positions.employee_id)
  )
)
with check (
  can_access_school(
    (select e.school_id from public.employees e where e.id = employee_positions.employee_id)
  )
);

drop policy if exists employee_certifications_staff_all on public.employee_certifications;

create policy employee_certifications_staff_all
on public.employee_certifications
for all
using (
  can_access_school(
    (select e.school_id from public.employees e where e.id = employee_certifications.employee_id)
  )
)
with check (
  can_access_school(
    (select e.school_id from public.employees e where e.id = employee_certifications.employee_id)
  )
);

drop policy if exists payroll_records_staff_all on public.payroll_records;

create policy payroll_records_staff_all
on public.payroll_records
for all
using (can_access_school(school_id))
with check (can_access_school(school_id));
