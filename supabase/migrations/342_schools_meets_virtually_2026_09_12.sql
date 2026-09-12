-- 342_schools_meets_virtually_2026_09_12.sql
--
-- Does this campus meet families virtually?
--
-- The thank-you page tells a family what happens next: "our admissions team is
-- sending you an email now for you to schedule…". For Florida and Georgia that
-- ends "your tour or meeting", because there is a building to walk around. For
-- the high school and Virtual there is not, and inviting somebody to book a
-- tour of a school that has no campus is the kind of small wrongness a family
-- notices and a school never hears about.
--
-- WHY A COLUMN RATHER THAN A LIST OF NAMES IN THE CODE. The obvious shortcut is
-- `if (name === 'The Academy HS' || name === 'The Academy Virtual')`. It works
-- until somebody renames a campus in the admin screen, at which point the page
-- silently starts offering tours again and nothing anywhere reports a problem.
-- Whether a campus meets families in person is a fact about the campus, so it
-- belongs on the campus.
--
-- Defaults to false: a school that has not said otherwise has a front door.
--
-- Safe to re-run.

alter table public.schools
  add column if not exists meets_virtually boolean not null default false;

comment on column public.schools.meets_virtually is
  'True when this campus meets prospective families online rather than in person. Drives what the inquiry thank-you page offers to schedule.';

update public.schools
set meets_virtually = true
where name in ('The Academy HS', 'The Academy Virtual')
  and meets_virtually is distinct from true;

-- Expect The Academy HS and The Academy Virtual true, the rest false.
select name, meets_virtually
from public.schools
order by name;
