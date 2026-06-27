-- Align constraint name with unique_student_class_enrollment

alter table enrollments drop constraint if exists unique_student_class;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'unique_student_class_enrollment'
  ) then
    alter table enrollments
    add constraint unique_student_class_enrollment
    unique (student_id, class_id);
  end if;
end $$;
