-- =========================================
-- SPRINT 1: COURSES & ENROLLMENTS
-- courses, course_sections, student_enrollments
-- =========================================

---

-- COURSES

---

create table public.courses (
id uuid primary key default gen_random_uuid(),

school_id uuid not null
references public.schools(id) on delete cascade,

code text not null,
name text not null,

description text,
subject text,

academic_level text,

minimum_age integer,
maximum_age integer,

credit_hours numeric(4,2)
check (
credit_hours is null
or credit_hours >= 0
),

status text not null default 'active'
check (
status in (
'draft',
'active',
'inactive',
'archived'
)
),

created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),

constraint courses_school_code_unique
unique (school_id, code),

constraint courses_age_range_check
check (
minimum_age is null
or maximum_age is null
or maximum_age >= minimum_age
)
);

create index idx_courses_school_id
on public.courses(school_id);

create trigger courses_set_updated_at
before update on public.courses
for each row
execute function public.trigger_set_updated_at();

---

-- COURSE SECTIONS

---

create table public.course_sections (
id uuid primary key default gen_random_uuid(),

course_id uuid not null
references public.courses(id) on delete cascade,

school_year_id uuid not null
references public.school_years(id) on delete restrict,

campus_id uuid
references public.campuses(id) on delete set null,

section_code text not null,

instructor_employee_id uuid
references public.employees(id) on delete set null,

max_capacity integer not null default 30,

minimum_student_age integer,
maximum_student_age integer,

status text not null default 'open'
check (
status in (
'draft',
'open',
'closed',
'cancelled',
'completed'
)
),

day_pattern text,

start_time_et time,
end_time_et time,

instructional_minutes integer not null default 50,

meeting_pattern jsonb not null default '{}'::jsonb,

created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),

constraint course_sections_max_capacity_check
check (max_capacity > 0),

constraint course_sections_age_range_check
check (
minimum_student_age is null
or maximum_student_age is null
or maximum_student_age >= minimum_student_age
),

constraint course_sections_instructional_minutes_check
check (instructional_minutes = 50),

constraint course_sections_unique_section
unique (
course_id,
school_year_id,
section_code
)
);

create index idx_course_sections_course_id
on public.course_sections(course_id);

create index idx_course_sections_school_year_id
on public.course_sections(school_year_id);

create index idx_course_sections_campus_id
on public.course_sections(campus_id);

create index idx_course_sections_instructor_employee_id
on public.course_sections(instructor_employee_id);

create trigger course_sections_set_updated_at
before update on public.course_sections
for each row
execute function public.trigger_set_updated_at();

---

-- STUDENT ENROLLMENTS

---

create table public.student_enrollments (
id uuid primary key default gen_random_uuid(),

student_id uuid not null
references public.students(id) on delete cascade,

course_section_id uuid not null
references public.course_sections(id) on delete cascade,

school_year_id uuid not null
references public.school_years(id) on delete restrict,

enrollment_status text not null default 'enrolled'
check (
enrollment_status in (
'pending',
'enrolled',
'waitlisted',
'dropped',
'completed'
)
),

enrolled_at timestamptz not null default now(),

dropped_at timestamptz,

created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),

constraint student_enrollments_unique_enrollment
unique (
student_id,
course_section_id
),

constraint student_enrollments_dropped_at_check
check (
dropped_at is null
or enrollment_status in (
'dropped',
'completed'
)
)
);

create index idx_student_enrollments_student_id
on public.student_enrollments(student_id);

create index idx_student_enrollments_course_section_id
on public.student_enrollments(course_section_id);

create index idx_student_enrollments_school_year_id
on public.student_enrollments(school_year_id);

create trigger student_enrollments_set_updated_at
before update on public.student_enrollments
for each row
execute function public.trigger_set_updated_at();
