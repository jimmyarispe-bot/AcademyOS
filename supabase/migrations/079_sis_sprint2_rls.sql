-- =========================================
-- SPRINT 2 SIS RLS (079)
-- Student-scoped policies + FERPA classifications
-- =========================================

-- ---------------------------------------------------------------------------
-- Students: extend policies with can_access_student_record + update
-- ---------------------------------------------------------------------------

drop policy if exists "students_select_school_scoped" on public.students;
create policy "students_select_school_scoped" on public.students
  for select to authenticated
  using (can_access_student_record(id));

drop policy if exists "students_insert_school_scoped" on public.students;
create policy "students_insert_school_scoped" on public.students
  for insert to authenticated
  with check (
    can_access_school(school_id)
    and (has_permission('students.edit') or is_enterprise_admin())
  );

drop policy if exists "students_update_school_scoped" on public.students;
create policy "students_update_school_scoped" on public.students
  for update to authenticated
  using (
    can_access_student_record(id)
    and (has_permission('students.edit') or is_enterprise_admin())
  )
  with check (
    can_access_school(school_id)
    and (has_permission('students.edit') or is_enterprise_admin())
  );

-- ---------------------------------------------------------------------------
-- Enable RLS on new SIS tables
-- ---------------------------------------------------------------------------

alter table public.sis_admissions_conversions enable row level security;
alter table public.student_medical_profiles enable row level security;
alter table public.student_special_education_plans enable row level security;
alter table public.student_special_education_goals enable row level security;
alter table public.student_academic_assessments enable row level security;
alter table public.student_academic_goals enable row level security;
alter table public.student_academic_interventions enable row level security;
alter table public.student_attendance_records enable row level security;
alter table public.student_period_attendance enable row level security;
alter table public.student_behavior_events enable row level security;
alter table public.student_service_sessions enable row level security;
alter table public.sis_sped_review_reminders enable row level security;

-- Generic student-scoped read (internal classification)
create or replace function public.sis_student_policy(check_student_id uuid, check_permission text default 'students.view')
returns boolean
language sql
stable
as $$
  select
    can_access_student_record(check_student_id)
    and (
      is_enterprise_admin()
      or has_permission(check_permission)
      or has_permission('students.view')
    );
$$;

-- Conversions (staff only)
drop policy if exists sis_admissions_conversions_select on public.sis_admissions_conversions;
create policy sis_admissions_conversions_select on public.sis_admissions_conversions
  for select to authenticated
  using (sis_student_policy(student_id));

drop policy if exists sis_admissions_conversions_insert on public.sis_admissions_conversions;
create policy sis_admissions_conversions_insert on public.sis_admissions_conversions
  for insert to authenticated
  with check (
    has_permission('students.edit') or is_enterprise_admin()
  );

-- Medical (FERPA medical classification)
drop policy if exists student_medical_profiles_select on public.student_medical_profiles;
create policy student_medical_profiles_select on public.student_medical_profiles
  for select to authenticated
  using (
    sis_student_policy(student_id)
    and can_access_classification('medical')
  );

drop policy if exists student_medical_profiles_write on public.student_medical_profiles;
create policy student_medical_profiles_write on public.student_medical_profiles
  for all to authenticated
  using (
    sis_student_policy(student_id, 'students.edit')
    and can_access_classification('medical')
  )
  with check (
    sis_student_policy(student_id, 'students.edit')
    and can_access_classification('medical')
  );

-- Special education (FERPA special_education classification)
drop policy if exists student_sped_plans_select on public.student_special_education_plans;
create policy student_sped_plans_select on public.student_special_education_plans
  for select to authenticated
  using (
    sis_student_policy(student_id)
    and can_access_classification('special_education')
  );

drop policy if exists student_sped_plans_write on public.student_special_education_plans;
create policy student_sped_plans_write on public.student_special_education_plans
  for all to authenticated
  using (
    sis_student_policy(student_id, 'students.edit')
    and can_access_classification('special_education')
  )
  with check (
    sis_student_policy(student_id, 'students.edit')
    and can_access_classification('special_education')
  );

drop policy if exists student_sped_goals_select on public.student_special_education_goals;
create policy student_sped_goals_select on public.student_special_education_goals
  for select to authenticated
  using (
    sis_student_policy(student_id)
    and can_access_classification('special_education')
  );

drop policy if exists student_sped_goals_write on public.student_special_education_goals;
create policy student_sped_goals_write on public.student_special_education_goals
  for all to authenticated
  using (
    sis_student_policy(student_id, 'students.edit')
    and can_access_classification('special_education')
  )
  with check (
    sis_student_policy(student_id, 'students.edit')
    and can_access_classification('special_education')
  );

-- Academic (internal — staff with students.view)
drop policy if exists student_academic_assessments_all on public.student_academic_assessments;
create policy student_academic_assessments_all on public.student_academic_assessments
  for all to authenticated
  using (sis_student_policy(student_id))
  with check (sis_student_policy(student_id, 'students.edit'));

drop policy if exists student_academic_goals_all on public.student_academic_goals;
create policy student_academic_goals_all on public.student_academic_goals
  for all to authenticated
  using (sis_student_policy(student_id))
  with check (sis_student_policy(student_id, 'students.edit'));

drop policy if exists student_academic_interventions_all on public.student_academic_interventions;
create policy student_academic_interventions_all on public.student_academic_interventions
  for all to authenticated
  using (sis_student_policy(student_id))
  with check (sis_student_policy(student_id, 'students.edit'));

-- Attendance
drop policy if exists student_attendance_records_all on public.student_attendance_records;
create policy student_attendance_records_all on public.student_attendance_records
  for all to authenticated
  using (sis_student_policy(student_id, 'students.attendance'))
  with check (sis_student_policy(student_id, 'students.attendance'));

drop policy if exists student_period_attendance_all on public.student_period_attendance;
create policy student_period_attendance_all on public.student_period_attendance
  for all to authenticated
  using (sis_student_policy(student_id, 'students.attendance'))
  with check (sis_student_policy(student_id, 'students.attendance'));

-- Behavior (discipline classification for suspensions/expulsions)
drop policy if exists student_behavior_events_select on public.student_behavior_events;
create policy student_behavior_events_select on public.student_behavior_events
  for select to authenticated
  using (
    sis_student_policy(student_id, 'students.behavior')
    and (
      event_type not in ('suspension', 'expulsion')
      or can_access_classification('confidential')
    )
  );

drop policy if exists student_behavior_events_write on public.student_behavior_events;
create policy student_behavior_events_write on public.student_behavior_events
  for all to authenticated
  using (sis_student_policy(student_id, 'students.behavior'))
  with check (sis_student_policy(student_id, 'students.behavior'));

-- Services
drop policy if exists student_service_sessions_all on public.student_service_sessions;
create policy student_service_sessions_all on public.student_service_sessions
  for all to authenticated
  using (sis_student_policy(student_id, 'students.services'))
  with check (sis_student_policy(student_id, 'students.services'));

-- SPED reminders (staff)
drop policy if exists sis_sped_review_reminders_select on public.sis_sped_review_reminders;
create policy sis_sped_review_reminders_select on public.sis_sped_review_reminders
  for select to authenticated
  using (sis_student_policy(student_id));

drop policy if exists sis_sped_review_reminders_write on public.sis_sped_review_reminders;
create policy sis_sped_review_reminders_write on public.sis_sped_review_reminders
  for all to authenticated
  using (has_permission('students.edit') or is_enterprise_admin())
  with check (has_permission('students.edit') or is_enterprise_admin());

-- ---------------------------------------------------------------------------
-- Auto-classify sensitive records on insert
-- ---------------------------------------------------------------------------

create or replace function public.sis_classify_student_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
begin
  select school_id into v_school_id from public.students where id = new.student_id;

  insert into public.platform_record_classifications (entity_type, entity_id, school_id, classification)
  values (
    TG_TABLE_NAME,
    new.id,
    v_school_id,
    case TG_TABLE_NAME
      when 'student_medical_profiles' then 'medical'
      when 'student_special_education_plans' then 'special_education'
      when 'student_special_education_goals' then 'special_education'
      when 'student_behavior_events' then
        case when new.event_type in ('suspension', 'expulsion') then 'confidential' else 'internal' end
      else 'internal'
    end
  )
  on conflict (entity_type, entity_id) do update set
    classification = excluded.classification,
    school_id = excluded.school_id;

  return new;
end;
$$;

drop trigger if exists trg_classify_medical on public.student_medical_profiles;
create trigger trg_classify_medical
  after insert on public.student_medical_profiles
  for each row execute function public.sis_classify_student_record();

drop trigger if exists trg_classify_sped_plan on public.student_special_education_plans;
create trigger trg_classify_sped_plan
  after insert on public.student_special_education_plans
  for each row execute function public.sis_classify_student_record();

drop trigger if exists trg_classify_sped_goal on public.student_special_education_goals;
create trigger trg_classify_sped_goal
  after insert on public.student_special_education_goals
  for each row execute function public.sis_classify_student_record();

drop trigger if exists trg_classify_behavior on public.student_behavior_events;
create trigger trg_classify_behavior
  after insert on public.student_behavior_events
  for each row execute function public.sis_classify_student_record();

-- SPED review reminder generation on plan save
create or replace function public.sis_sync_sped_review_reminders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.annual_review_date is not null then
    insert into public.sis_sped_review_reminders (student_id, plan_id, reminder_type, due_date)
    values (new.student_id, new.id, 'annual_review', new.annual_review_date)
    on conflict (plan_id, reminder_type, due_date) do nothing;
  end if;
  if new.reevaluation_date is not null then
    insert into public.sis_sped_review_reminders (student_id, plan_id, reminder_type, due_date)
    values (new.student_id, new.id, 'reevaluation', new.reevaluation_date)
    on conflict (plan_id, reminder_type, due_date) do nothing;
  end if;
  if new.evaluation_date is not null then
    insert into public.sis_sped_review_reminders (student_id, plan_id, reminder_type, due_date)
    values (new.student_id, new.id, 'evaluation', new.evaluation_date)
    on conflict (plan_id, reminder_type, due_date) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_sped_reminders on public.student_special_education_plans;
create trigger trg_sync_sped_reminders
  after insert or update on public.student_special_education_plans
  for each row execute function public.sis_sync_sped_review_reminders();

grant execute on function public.sis_student_policy(uuid, text) to authenticated, service_role;
grant execute on function public.generate_student_number(uuid) to authenticated, service_role;
