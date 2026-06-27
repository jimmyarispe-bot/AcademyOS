-- =========================================
-- SPRINT 3 SCHEDULING RLS (083)
-- =========================================

alter table public.academic_terms enable row level security;
alter table public.academic_calendars enable row level security;
alter table public.academic_calendar_events enable row level security;
alter table public.schedule_rooms enable row level security;
alter table public.section_staff_assignments enable row level security;
alter table public.schedule_session_generation_runs enable row level security;
alter table public.session_attendance_records enable row level security;
alter table public.schedule_conflicts enable row level security;
alter table public.schedule_room_bookings enable row level security;
alter table public.schedule_academy_way_config enable row level security;

create or replace function public.scheduling_policy(check_school_id uuid, check_permission text default 'scheduling.view')
returns boolean language sql stable as $$
  select
    can_access_school(check_school_id)
    and (is_enterprise_admin() or has_permission(check_permission) or has_permission('scheduling.view'));
$$;

-- Academic terms
drop policy if exists academic_terms_all on public.academic_terms;
create policy academic_terms_all on public.academic_terms
  for all to authenticated
  using (scheduling_policy(school_id))
  with check (scheduling_policy(school_id, 'scheduling.manage'));

-- Calendars
drop policy if exists academic_calendars_all on public.academic_calendars;
create policy academic_calendars_all on public.academic_calendars
  for all to authenticated
  using (scheduling_policy(school_id))
  with check (scheduling_policy(school_id, 'scheduling.manage'));

drop policy if exists academic_calendar_events_all on public.academic_calendar_events;
create policy academic_calendar_events_all on public.academic_calendar_events
  for all to authenticated
  using (
    exists (
      select 1 from public.academic_calendars c
      where c.id = calendar_id and scheduling_policy(c.school_id)
    )
  )
  with check (
    exists (
      select 1 from public.academic_calendars c
      where c.id = calendar_id and scheduling_policy(c.school_id, 'scheduling.manage')
    )
  );

-- Rooms
drop policy if exists schedule_rooms_all on public.schedule_rooms;
create policy schedule_rooms_all on public.schedule_rooms
  for all to authenticated
  using (scheduling_policy(school_id))
  with check (scheduling_policy(school_id, 'scheduling.manage'));

-- Section staff
drop policy if exists section_staff_assignments_all on public.section_staff_assignments;
create policy section_staff_assignments_all on public.section_staff_assignments
  for all to authenticated
  using (
    exists (
      select 1 from public.course_sections cs
      join public.courses c on c.id = cs.course_id
      where cs.id = course_section_id and scheduling_policy(c.school_id)
    )
  )
  with check (
    exists (
      select 1 from public.course_sections cs
      join public.courses c on c.id = cs.course_id
      where cs.id = course_section_id and scheduling_policy(c.school_id, 'scheduling.manage')
    )
  );

-- Generation runs
drop policy if exists schedule_generation_runs_all on public.schedule_session_generation_runs;
create policy schedule_generation_runs_all on public.schedule_session_generation_runs
  for all to authenticated
  using (scheduling_policy(school_id))
  with check (scheduling_policy(school_id, 'scheduling.generate'));

-- Session attendance
drop policy if exists session_attendance_records_all on public.session_attendance_records;
create policy session_attendance_records_all on public.session_attendance_records
  for all to authenticated
  using (
    can_access_student_record(student_id)
    and (has_permission('scheduling.attendance') or has_permission('students.attendance'))
  )
  with check (
    can_access_student_record(student_id)
    and (has_permission('scheduling.attendance') or has_permission('students.attendance'))
  );

-- Conflicts
drop policy if exists schedule_conflicts_read on public.schedule_conflicts;
create policy schedule_conflicts_read on public.schedule_conflicts
  for select to authenticated using (scheduling_policy(school_id));

drop policy if exists schedule_conflicts_write on public.schedule_conflicts;
create policy schedule_conflicts_write on public.schedule_conflicts
  for all to authenticated
  using (scheduling_policy(school_id, 'scheduling.manage'))
  with check (scheduling_policy(school_id, 'scheduling.manage'));

-- Room bookings
drop policy if exists schedule_room_bookings_all on public.schedule_room_bookings;
create policy schedule_room_bookings_all on public.schedule_room_bookings
  for all to authenticated
  using (
    exists (
      select 1 from public.schedule_rooms r
      where r.id = room_id and scheduling_policy(r.school_id)
    )
  )
  with check (
    exists (
      select 1 from public.schedule_rooms r
      where r.id = room_id and scheduling_policy(r.school_id, 'scheduling.manage')
    )
  );

-- Academy Way config
drop policy if exists schedule_academy_way_config_read on public.schedule_academy_way_config;
create policy schedule_academy_way_config_read on public.schedule_academy_way_config
  for select to authenticated using (can_access_school(school_id) or is_enterprise_admin());

drop policy if exists schedule_academy_way_config_write on public.schedule_academy_way_config;
create policy schedule_academy_way_config_write on public.schedule_academy_way_config
  for all to authenticated
  using (has_permission('scheduling.manage') and can_access_school(school_id))
  with check (has_permission('scheduling.manage') and can_access_school(school_id));

grant execute on function public.scheduling_policy(uuid, text) to authenticated, service_role;
