-- =========================================
-- SPRINT 4 TEACHER WORKSPACE RLS (085)
-- =========================================

alter table public.instructional_session_deliveries enable row level security;
alter table public.instructional_session_student_records enable row level security;
alter table public.student_academic_progress_records enable row level security;
alter table public.structured_literacy_progress enable row level security;
alter table public.student_learning_artifacts enable row level security;
alter table public.teacher_instructional_notes enable row level security;
alter table public.teacher_lesson_plans enable row level security;
alter table public.teacher_lesson_plan_sections enable row level security;
alter table public.session_assessment_records enable row level security;
alter table public.teacher_parent_outreach enable row level security;
alter table public.teacher_ai_readiness_config enable row level security;

-- Resolve employee for current user
create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.id
  from public.employees e
  where e.user_id = auth.uid()
    and e.employment_status = 'active'
  limit 1;
$$;

-- Teacher can access session if primary/co/sub instructor or has permission
create or replace function public.teacher_can_access_session(check_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    is_enterprise_admin()
    or (
      has_permission('teacher.view')
      and exists (
        select 1
        from public.instructional_sessions s
        join public.course_sections cs on cs.id = s.course_section_id
        join public.courses c on c.id = cs.course_id
        where s.id = check_session_id
          and can_access_school(c.school_id)
          and (
            s.instructor_employee_id = current_employee_id()
            or exists (
              select 1 from public.section_staff_assignments sa
              where sa.course_section_id = cs.id
                and sa.employee_id = current_employee_id()
                and sa.is_active = true
            )
          )
      )
    )
    or (
      has_permission('teacher.view')
      and exists (
        select 1
        from public.instructional_sessions s
        join public.course_sections cs on cs.id = s.course_section_id
        join public.courses c on c.id = cs.course_id
        where s.id = check_session_id
          and can_access_school(c.school_id)
      )
    );
$$;

create or replace function public.teacher_student_policy(check_student_id uuid, check_permission text default 'teacher.view')
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
    );
$$;

-- Session deliveries
drop policy if exists instructional_session_deliveries_all on public.instructional_session_deliveries;
create policy instructional_session_deliveries_all on public.instructional_session_deliveries
  for all to authenticated
  using (teacher_can_access_session(instructional_session_id))
  with check (
    teacher_can_access_session(instructional_session_id)
    and (has_permission('teacher.manage') or has_permission('teacher.attendance'))
  );

-- Session student records
drop policy if exists instructional_session_student_records_all on public.instructional_session_student_records;
create policy instructional_session_student_records_all on public.instructional_session_student_records
  for all to authenticated
  using (
    teacher_can_access_session(instructional_session_id)
    and teacher_student_policy(student_id)
  )
  with check (
    teacher_can_access_session(instructional_session_id)
    and teacher_student_policy(student_id, 'teacher.manage')
  );

-- Academic progress
drop policy if exists student_academic_progress_records_all on public.student_academic_progress_records;
create policy student_academic_progress_records_all on public.student_academic_progress_records
  for all to authenticated
  using (teacher_student_policy(student_id))
  with check (teacher_student_policy(student_id, 'teacher.manage'));

-- Structured literacy
drop policy if exists structured_literacy_progress_all on public.structured_literacy_progress;
create policy structured_literacy_progress_all on public.structured_literacy_progress
  for all to authenticated
  using (teacher_student_policy(student_id))
  with check (teacher_student_policy(student_id, 'teacher.manage'));

-- Artifacts
drop policy if exists student_learning_artifacts_all on public.student_learning_artifacts;
create policy student_learning_artifacts_all on public.student_learning_artifacts
  for all to authenticated
  using (teacher_student_policy(student_id))
  with check (teacher_student_policy(student_id, 'teacher.manage'));

-- Teacher notes (own notes or admin)
drop policy if exists teacher_instructional_notes_all on public.teacher_instructional_notes;
create policy teacher_instructional_notes_all on public.teacher_instructional_notes
  for all to authenticated
  using (
    employee_id = current_employee_id()
    or is_enterprise_admin()
    or (has_permission('teacher.compliance') and exists (
      select 1 from public.employees e where e.id = employee_id and can_access_school(e.school_id)
    ))
  )
  with check (
    employee_id = current_employee_id()
    or has_permission('teacher.manage')
  );

-- Lesson plans
drop policy if exists teacher_lesson_plans_all on public.teacher_lesson_plans;
create policy teacher_lesson_plans_all on public.teacher_lesson_plans
  for all to authenticated
  using (
    employee_id = current_employee_id()
    or (has_permission('teacher.view') and can_access_school(school_id))
  )
  with check (
    (employee_id = current_employee_id() or has_permission('teacher.manage'))
    and can_access_school(school_id)
  );

drop policy if exists teacher_lesson_plan_sections_all on public.teacher_lesson_plan_sections;
create policy teacher_lesson_plan_sections_all on public.teacher_lesson_plan_sections
  for all to authenticated
  using (
    exists (
      select 1 from public.teacher_lesson_plans lp
      where lp.id = lesson_plan_id
        and (lp.employee_id = current_employee_id() or has_permission('teacher.view'))
    )
  )
  with check (
    exists (
      select 1 from public.teacher_lesson_plans lp
      where lp.id = lesson_plan_id and lp.employee_id = current_employee_id()
    )
  );

-- Session assessments
drop policy if exists session_assessment_records_all on public.session_assessment_records;
create policy session_assessment_records_all on public.session_assessment_records
  for all to authenticated
  using (
    teacher_can_access_session(instructional_session_id)
    and teacher_student_policy(student_id)
  )
  with check (
    teacher_can_access_session(instructional_session_id)
    and teacher_student_policy(student_id, 'teacher.manage')
  );

-- Parent outreach
drop policy if exists teacher_parent_outreach_all on public.teacher_parent_outreach;
create policy teacher_parent_outreach_all on public.teacher_parent_outreach
  for all to authenticated
  using (
    employee_id = current_employee_id()
    and teacher_student_policy(student_id)
  )
  with check (
    employee_id = current_employee_id()
    and teacher_student_policy(student_id, 'teacher.communicate')
  );

-- AI readiness (read-only for teachers, write for admins)
drop policy if exists teacher_ai_readiness_config_read on public.teacher_ai_readiness_config;
create policy teacher_ai_readiness_config_read on public.teacher_ai_readiness_config
  for select to authenticated
  using (can_access_school(school_id) or is_enterprise_admin());

drop policy if exists teacher_ai_readiness_config_write on public.teacher_ai_readiness_config;
create policy teacher_ai_readiness_config_write on public.teacher_ai_readiness_config
  for all to authenticated
  using (is_enterprise_admin())
  with check (is_enterprise_admin());

grant execute on function public.current_employee_id() to authenticated, service_role;
grant execute on function public.teacher_can_access_session(uuid) to authenticated, service_role;
grant execute on function public.teacher_student_policy(uuid, text) to authenticated, service_role;
