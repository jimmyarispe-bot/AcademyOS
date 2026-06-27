-- Role- and membership-based school read access (replaces school_scoped_access)

drop policy if exists "school_scoped_access" on schools;

create policy "school_access"
on schools
for select
using (
  has_role('CEO')
  or has_role('SCHOOL_LEADER')
  or is_school_member(id)
);
