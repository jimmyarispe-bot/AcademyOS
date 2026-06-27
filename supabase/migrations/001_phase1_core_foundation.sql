-- =========================
-- PHASE 1: CORE FOUNDATION
-- Education Operating System (EduOS)
-- =========================

-- =========================
-- SCHOOLS
-- =========================
create table schools (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    address text,
    timezone text,
    created_at timestamp default now()
);

create table school_settings (
    id uuid primary key default gen_random_uuid(),
    school_id uuid references schools(id) on delete cascade,
    config jsonb default '{}'::jsonb,
    created_at timestamp default now()
);

-- =========================
-- USERS
-- =========================
create table users (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    full_name text,
    created_at timestamp default now()
);

-- =========================
-- ROLES
-- =========================
create table roles (
    id uuid primary key default gen_random_uuid(),
    name text unique not null
);

insert into roles (name) values
('CEO'),
('SCHOOL_LEADER'),
('TEACHER'),
('PARENT'),
('STUDENT'),
('EMPLOYEE');

create table user_roles (
    user_id uuid references users(id) on delete cascade,
    role_id uuid references roles(id) on delete cascade,
    primary key (user_id, role_id)
);

-- =========================
-- STUDENTS (CORE ENTITY)
-- =========================
create table students (
    id uuid primary key default gen_random_uuid(),
    school_id uuid references schools(id) on delete cascade,

    first_name text not null,
    last_name text not null,

    status text default 'active',
    grade_level text,

    created_at timestamp default now()
);

-- =========================
-- PARENT ↔ STUDENT LINK
-- =========================
create table student_family_link (
    id uuid primary key default gen_random_uuid(),
    student_id uuid references students(id) on delete cascade,
    user_id uuid references users(id) on delete cascade,
    relationship_type text,
    created_at timestamp default now()
);

-- =========================
-- CLASSES
-- =========================
create table classes (
    id uuid primary key default gen_random_uuid(),
    school_id uuid references schools(id) on delete cascade,
    teacher_id uuid references users(id),

    subject text,
    created_at timestamp default now()
);

-- =========================
-- ENROLLMENTS
-- =========================
create table enrollments (
    id uuid primary key default gen_random_uuid(),
    student_id uuid references students(id) on delete cascade,
    class_id uuid references classes(id) on delete cascade,
    enrolled_at timestamp default now()
);

-- =========================
-- INDEXES
-- =========================
create index idx_school_settings_school_id on school_settings(school_id);
create index idx_students_school_id on students(school_id);
create index idx_student_family_link_student_id on student_family_link(student_id);
create index idx_student_family_link_user_id on student_family_link(user_id);
create index idx_classes_school_id on classes(school_id);
create index idx_classes_teacher_id on classes(teacher_id);
create index idx_enrollments_student_id on enrollments(student_id);
create index idx_enrollments_class_id on enrollments(class_id);
