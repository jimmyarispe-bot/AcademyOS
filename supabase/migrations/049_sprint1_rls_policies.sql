-- =========================================
-- SPRINT 1: ROW LEVEL SECURITY
-- AcademyOS
-- =========================================

-- -----------------------------------------
-- Helper Functions
-- -----------------------------------------

create or replace function public.school_id_for_employee(p_employee_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select school_id
  from public.employees
  where id = p_employee_id;
$$;

create or replace function public.school_id_for_course(p_course_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select school_id
  from public.courses
  where id = p_course_id;
$$;

create or replace function public.school_id_for_course_section(p_section_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select c.school_id
  from public.course_sections cs
  join public.courses c
    on c.id = cs.course_id
  where cs.id = p_section_id;
$$;

create or replace function public.is_self_employee(p_employee_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.employees e
    where e.id = p_employee_id
      and e.user_id = auth.uid()
  );
$$;

-- -----------------------------------------
-- Enable RLS
-- -----------------------------------------

alter table public.campuses enable row level security;
alter table public.school_years enable row level security;
alter table public.student_learning_profiles enable row level security;
alter table public.student_documents enable row level security;
alter table public.student_schedule_preferences enable row level security;
alter table public.employees enable row level security;
alter table public.employee_profiles enable row level security;
alter table public.employee_availability enable row level security;
alter table public.employee_age_preferences enable row level security;
alter table public.courses enable row level security;
alter table public.course_sections enable row level security;
alter table public.student_enrollments enable row level security;
alter table public.instructional_sessions enable row level security;
alter table public.contractor_pay_ledger enable row level security;

-- =========================================
-- CAMPUSES
-- =========================================

create policy campuses_select
on public.campuses
for select
using (can_access_school(school_id));

create policy campuses_insert
on public.campuses
for insert
with check (can_access_school(school_id));

create policy campuses_update
on public.campuses
for update
using (can_access_school(school_id))
with check (can_access_school(school_id));

create policy campuses_delete
on public.campuses
for delete
using (can_access_school(school_id));

-- =========================================
-- SCHOOL YEARS
-- =========================================

create policy school_years_select
on public.school_years
for select
using (can_access_school(school_id));

create policy school_years_insert
on public.school_years
for insert
with check (can_access_school(school_id));

create policy school_years_update
on public.school_years
for update
using (can_access_school(school_id))
with check (can_access_school(school_id));

create policy school_years_delete
on public.school_years
for delete
using (can_access_school(school_id));

-- =========================================
-- STUDENT TABLES
-- =========================================

create policy student_learning_profiles_select
on public.student_learning_profiles
for select
using (
  can_access_school(
    school_id_for_student(student_id)
  )
);

create policy student_learning_profiles_insert
on public.student_learning_profiles
for insert
with check (
  can_access_school(
    school_id_for_student(student_id)
  )
);

create policy student_learning_profiles_update
on public.student_learning_profiles
for update
using (
  can_access_school(
    school_id_for_student(student_id)
  )
)
with check (
  can_access_school(
    school_id_for_student(student_id)
  )
);

create policy student_learning_profiles_delete
on public.student_learning_profiles
for delete
using (
  can_access_school(
    school_id_for_student(student_id)
  )
);

create policy student_documents_select
on public.student_documents
for select
using (
  can_access_school(
    school_id_for_student(student_id)
  )
);

create policy student_documents_insert
on public.student_documents
for insert
with check (
  can_access_school(
    school_id_for_student(student_id)
  )
);

create policy student_documents_update
on public.student_documents
for update
using (
  can_access_school(
    school_id_for_student(student_id)
  )
)
with check (
  can_access_school(
    school_id_for_student(student_id)
  )
);

create policy student_documents_delete
on public.student_documents
for delete
using (
  can_access_school(
    school_id_for_student(student_id)
  )
);

create policy student_schedule_preferences_select
on public.student_schedule_preferences
for select
using (
  can_access_school(
    school_id_for_student(student_id)
  )
);

create policy student_schedule_preferences_insert
on public.student_schedule_preferences
for insert
with check (
  can_access_school(
    school_id_for_student(student_id)
  )
);

create policy student_schedule_preferences_update
on public.student_schedule_preferences
for update
using (
  can_access_school(
    school_id_for_student(student_id)
  )
)
with check (
  can_access_school(
    school_id_for_student(student_id)
  )
);

create policy student_schedule_preferences_delete
on public.student_schedule_preferences
for delete
using (
  can_access_school(
    school_id_for_student(student_id)
  )
);

-- =========================================
-- EMPLOYEES
-- =========================================

create policy employees_select
on public.employees
for select
using (
  can_access_school(school_id)
  or user_id = auth.uid()
);

create policy employees_insert
on public.employees
for insert
with check (
  can_access_school(school_id)
);

create policy employees_update
on public.employees
for update
using (
  can_access_school(school_id)
)
with check (
  can_access_school(school_id)
);

create policy employees_delete
on public.employees
for delete
using (
  can_access_school(school_id)
);

-- =========================================
-- EMPLOYEE CHILD TABLES
-- =========================================

create policy employee_profiles_all
on public.employee_profiles
for all
using (
  can_access_school(
    school_id_for_employee(employee_id)
  )
  or is_self_employee(employee_id)
)
with check (
  can_access_school(
    school_id_for_employee(employee_id)
  )
  or is_self_employee(employee_id)
);

create policy employee_availability_all
on public.employee_availability
for all
using (
  can_access_school(
    school_id_for_employee(employee_id)
  )
  or is_self_employee(employee_id)
)
with check (
  can_access_school(
    school_id_for_employee(employee_id)
  )
  or is_self_employee(employee_id)
);

create policy employee_age_preferences_all
on public.employee_age_preferences
for all
using (
  can_access_school(
    school_id_for_employee(employee_id)
  )
)
with check (
  can_access_school(
    school_id_for_employee(employee_id)
  )
);

-- =========================================
-- COURSES
-- =========================================

create policy courses_all
on public.courses
for all
using (
  can_access_school(school_id)
)
with check (
  can_access_school(school_id)
);

create policy course_sections_all
on public.course_sections
for all
using (
  can_access_school(
    school_id_for_course(course_id)
  )
)
with check (
  can_access_school(
    school_id_for_course(course_id)
  )
);

create policy student_enrollments_all
on public.student_enrollments
for all
using (
  can_access_school(
    school_id_for_student(student_id)
  )
)
with check (
  can_access_school(
    school_id_for_student(student_id)
  )
);

-- =========================================
-- SESSIONS
-- =========================================

create policy instructional_sessions_all
on public.instructional_sessions
for all
using (
  can_access_school(
    school_id_for_course_section(course_section_id)
  )
)
with check (
  can_access_school(
    school_id_for_course_section(course_section_id)
  )
);

-- =========================================
-- PAYROLL
-- =========================================

create policy contractor_pay_ledger_all
on public.contractor_pay_ledger
for all
using (
  can_access_school(school_id)
  or is_self_employee(employee_id)
)
with check (
  can_access_school(school_id)
);