-- =========================================
-- SPRINT 4.2 COLLABORATIVE INSTRUCTION RLS (087)
-- =========================================

alter table public.student_instructional_teams enable row level security;
alter table public.student_instructional_team_members enable row level security;
alter table public.student_growth_goals enable row level security;
alter table public.instructional_session_outcomes enable row level security;
alter table public.intervention_effectiveness_records enable row level security;
alter table public.student_instructional_meetings enable row level security;
alter table public.student_instructional_meeting_participants enable row level security;
alter table public.student_instructional_meeting_tasks enable row level security;
alter table public.student_collaboration_feed_events enable row level security;

create or replace function public.instruction_student_policy(
  check_student_id uuid,
  check_permission text default 'instruction.team'
)
returns boolean
language sql
stable
as $$
  select
    can_access_student_record(check_student_id)
    and (
      is_enterprise_admin()
      or has_permission(check_permission)
      or has_permission('teacher.view')
      or has_permission('students.view')
    );
$$;

create or replace function public.is_student_team_member(check_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.student_instructional_teams t
    join public.student_instructional_team_members m on m.team_id = t.id
    join public.employees e on e.id = m.employee_id
    where t.student_id = check_student_id
      and t.is_active = true
      and m.is_active = true
      and e.user_id = auth.uid()
  );
$$;

-- Teams
drop policy if exists student_instructional_teams_all on public.student_instructional_teams;
create policy student_instructional_teams_all on public.student_instructional_teams
  for all to authenticated
  using (instruction_student_policy(student_id))
  with check (instruction_student_policy(student_id, 'instruction.team'));

drop policy if exists student_instructional_team_members_all on public.student_instructional_team_members;
create policy student_instructional_team_members_all on public.student_instructional_team_members
  for all to authenticated
  using (
    exists (
      select 1 from public.student_instructional_teams t
      where t.id = team_id and instruction_student_policy(t.student_id)
    )
  )
  with check (
    exists (
      select 1 from public.student_instructional_teams t
      where t.id = team_id and instruction_student_policy(t.student_id, 'instruction.team')
    )
  );

-- Growth goals
drop policy if exists student_growth_goals_all on public.student_growth_goals;
create policy student_growth_goals_all on public.student_growth_goals
  for all to authenticated
  using (instruction_student_policy(student_id))
  with check (instruction_student_policy(student_id, 'instruction.growth_plan'));

-- Session outcomes
drop policy if exists instructional_session_outcomes_all on public.instructional_session_outcomes;
create policy instructional_session_outcomes_all on public.instructional_session_outcomes
  for all to authenticated
  using (
    teacher_can_access_session(instructional_session_id)
    and (student_id is null or instruction_student_policy(student_id))
  )
  with check (
    teacher_can_access_session(instructional_session_id)
    and (student_id is null or instruction_student_policy(student_id, 'teacher.manage'))
  );

-- Intervention effectiveness
drop policy if exists intervention_effectiveness_records_all on public.intervention_effectiveness_records;
create policy intervention_effectiveness_records_all on public.intervention_effectiveness_records
  for all to authenticated
  using (instruction_student_policy(student_id))
  with check (instruction_student_policy(student_id, 'instruction.growth_plan'));

-- Meetings
drop policy if exists student_instructional_meetings_all on public.student_instructional_meetings;
create policy student_instructional_meetings_all on public.student_instructional_meetings
  for all to authenticated
  using (instruction_student_policy(student_id))
  with check (instruction_student_policy(student_id, 'instruction.meetings'));

drop policy if exists student_instructional_meeting_participants_all on public.student_instructional_meeting_participants;
create policy student_instructional_meeting_participants_all on public.student_instructional_meeting_participants
  for all to authenticated
  using (
    exists (
      select 1 from public.student_instructional_meetings m
      where m.id = meeting_id and instruction_student_policy(m.student_id)
    )
  )
  with check (
    exists (
      select 1 from public.student_instructional_meetings m
      where m.id = meeting_id and instruction_student_policy(m.student_id, 'instruction.meetings')
    )
  );

drop policy if exists student_instructional_meeting_tasks_all on public.student_instructional_meeting_tasks;
create policy student_instructional_meeting_tasks_all on public.student_instructional_meeting_tasks
  for all to authenticated
  using (
    exists (
      select 1 from public.student_instructional_meetings m
      where m.id = meeting_id and instruction_student_policy(m.student_id)
    )
  )
  with check (
    exists (
      select 1 from public.student_instructional_meetings m
      where m.id = meeting_id and instruction_student_policy(m.student_id, 'instruction.meetings')
    )
  );

-- Collaboration feed (team members + authorized staff)
drop policy if exists student_collaboration_feed_read on public.student_collaboration_feed_events;
create policy student_collaboration_feed_read on public.student_collaboration_feed_events
  for select to authenticated
  using (
    instruction_student_policy(student_id)
    and (
      classification = 'public'
      or is_student_team_member(student_id)
      or has_permission('instruction.team')
      or is_enterprise_admin()
    )
  );

drop policy if exists student_collaboration_feed_write on public.student_collaboration_feed_events;
create policy student_collaboration_feed_write on public.student_collaboration_feed_events
  for insert to authenticated
  with check (instruction_student_policy(student_id, 'teacher.manage'));

grant execute on function public.instruction_student_policy(uuid, text) to authenticated, service_role;
grant execute on function public.is_student_team_member(uuid) to authenticated, service_role;
