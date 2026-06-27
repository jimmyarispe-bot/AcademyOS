-- Class read access for CEO, school leaders, and assigned teachers

create policy "class_access"
on classes
for select
using (
  has_role('CEO')
  or has_role('SCHOOL_LEADER')
  or teacher_id = auth.uid()
);
