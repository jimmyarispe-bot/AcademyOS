-- Enable Row Level Security on all Phase 1 EduOS tables

alter table schools enable row level security;
alter table school_settings enable row level security;
alter table users enable row level security;
alter table roles enable row level security;
alter table user_roles enable row level security;
alter table students enable row level security;
alter table student_family_link enable row level security;
alter table classes enable row level security;
alter table enrollments enable row level security;
