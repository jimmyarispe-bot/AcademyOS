-- Scholarship Applications (Admin Reviewed Model)

create table scholarship_applications (
  id uuid primary key default gen_random_uuid(),

  parent_email text not null,
  student_name text not null,

  household_income numeric,
  tax_years jsonb, -- uploaded tax return references or metadata

  requested_amount numeric,

  suggested_min numeric,
  suggested_max numeric,

  admin_approved_amount numeric,

  status text default 'pending', 
  -- pending | reviewed | approved | rejected

  reviewed_by text,
  reviewed_at timestamp,

  created_at timestamp default now()
);