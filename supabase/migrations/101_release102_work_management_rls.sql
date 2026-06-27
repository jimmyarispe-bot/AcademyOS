-- =========================================
-- RELEASE 10.2 RLS: Enterprise Work Management
-- =========================================

alter table public.work_playbooks enable row level security;
alter table public.work_playbook_steps enable row level security;
alter table public.work_playbook_runs enable row level security;
alter table public.work_projects enable row level security;
alter table public.work_milestones enable row level security;
alter table public.work_tasks enable row level security;
alter table public.work_task_assignees enable row level security;
alter table public.work_task_dependencies enable row level security;
alter table public.work_task_checklists enable row level security;
alter table public.work_checklist_items enable row level security;
alter table public.work_task_comments enable row level security;
alter table public.work_task_attachments enable row level security;
alter table public.work_activity_log enable row level security;
alter table public.work_time_entries enable row level security;
alter table public.work_project_risks enable row level security;
alter table public.work_status_history enable row level security;

-- Playbooks
drop policy if exists work_playbooks_read on public.work_playbooks;
create policy work_playbooks_read on public.work_playbooks
  for select to authenticated
  using (
    has_permission('work.view') or has_permission('work.manage') or has_permission('work.admin')
    or (school_id is null or can_access_school(school_id))
  );

drop policy if exists work_playbooks_manage on public.work_playbooks;
create policy work_playbooks_manage on public.work_playbooks
  for all to authenticated
  using (
    has_permission('work.admin')
    or (has_permission('work.manage') and (school_id is null or can_access_school(school_id)))
  )
  with check (
    has_permission('work.admin')
    or (has_permission('work.manage') and (school_id is null or can_access_school(school_id)))
  );

drop policy if exists work_playbook_steps_access on public.work_playbook_steps;
create policy work_playbook_steps_access on public.work_playbook_steps
  for all to authenticated
  using (
    exists (
      select 1 from public.work_playbooks pb
      where pb.id = playbook_id
        and (has_permission('work.view') or has_permission('work.manage') or has_permission('work.admin'))
    )
  )
  with check (has_permission('work.admin') or has_permission('work.manage'));

drop policy if exists work_playbook_runs_access on public.work_playbook_runs;
create policy work_playbook_runs_access on public.work_playbook_runs
  for all to authenticated
  using (
    has_permission('work.view') or has_permission('work.manage')
    or started_by = auth.uid()
    or (school_id is null or can_access_school(school_id))
  )
  with check (has_permission('work.manage') or started_by = auth.uid());

-- Projects
drop policy if exists work_projects_access on public.work_projects;
create policy work_projects_access on public.work_projects
  for all to authenticated
  using (
    (
      (school_id is null or can_access_school(school_id))
      and (has_permission('work.view') or has_permission('work.manage') or has_permission('work.executive'))
    )
    or owner_user_id = auth.uid()
    or created_by = auth.uid()
    or exists (
      select 1 from public.work_tasks t
      where t.project_id = work_projects.id
        and (t.owner_user_id = auth.uid() or exists (
          select 1 from public.work_task_assignees a where a.task_id = t.id and a.user_id = auth.uid()
        ))
    )
  )
  with check (
    (school_id is null or can_access_school(school_id))
    and (has_permission('work.manage') or owner_user_id = auth.uid() or created_by = auth.uid())
  );

-- Milestones
drop policy if exists work_milestones_access on public.work_milestones;
create policy work_milestones_access on public.work_milestones
  for all to authenticated
  using (
    exists (
      select 1 from public.work_projects p
      where p.id = project_id
        and (
          (p.school_id is null or can_access_school(p.school_id))
          and (has_permission('work.view') or has_permission('work.manage'))
          or p.owner_user_id = auth.uid()
        )
    )
  )
  with check (
    exists (
      select 1 from public.work_projects p
      where p.id = project_id
        and (has_permission('work.manage') or p.owner_user_id = auth.uid())
    )
  );

-- Tasks
drop policy if exists work_tasks_access on public.work_tasks;
create policy work_tasks_access on public.work_tasks
  for all to authenticated
  using (
    (
      (school_id is null or can_access_school(school_id))
      and (has_permission('work.view') or has_permission('work.manage'))
    )
    or owner_user_id = auth.uid()
    or created_by = auth.uid()
    or exists (select 1 from public.work_task_assignees a where a.task_id = work_tasks.id and a.user_id = auth.uid())
    or (student_id is not null and is_parent_of_student(student_id))
    or (student_id is not null and exists (select 1 from public.students s where s.id = student_id and s.user_id = auth.uid()))
    or (employee_id is not null and is_self_employee(employee_id))
  )
  with check (
    (
      (school_id is null or can_access_school(school_id))
      and (has_permission('work.manage') or owner_user_id = auth.uid() or created_by = auth.uid())
    )
    or owner_user_id = auth.uid()
    or exists (select 1 from public.work_task_assignees a where a.task_id = work_tasks.id and a.user_id = auth.uid() and a.role in ('assignee','reviewer'))
    or (employee_id is not null and is_self_employee(employee_id))
  );

drop policy if exists work_task_assignees_access on public.work_task_assignees;
create policy work_task_assignees_access on public.work_task_assignees
  for all to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.work_tasks t
      where t.id = task_id
        and (has_permission('work.view') or t.owner_user_id = auth.uid())
    )
  )
  with check (
    has_permission('work.manage')
    or exists (select 1 from public.work_tasks t where t.id = task_id and t.owner_user_id = auth.uid())
  );

drop policy if exists work_task_dependencies_access on public.work_task_dependencies;
create policy work_task_dependencies_access on public.work_task_dependencies
  for all to authenticated
  using (has_permission('work.view') or has_permission('work.manage'))
  with check (has_permission('work.manage'));

drop policy if exists work_task_checklists_access on public.work_task_checklists;
create policy work_task_checklists_access on public.work_task_checklists
  for all to authenticated
  using (
    exists (
      select 1 from public.work_tasks t
      where t.id = task_id
        and (has_permission('work.view') or t.owner_user_id = auth.uid()
          or exists (select 1 from public.work_task_assignees a where a.task_id = t.id and a.user_id = auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.work_tasks t
      where t.id = task_id
        and (has_permission('work.manage') or t.owner_user_id = auth.uid()
          or exists (select 1 from public.work_task_assignees a where a.task_id = t.id and a.user_id = auth.uid()))
    )
  );

drop policy if exists work_checklist_items_access on public.work_checklist_items;
create policy work_checklist_items_access on public.work_checklist_items
  for all to authenticated
  using (
    exists (
      select 1 from public.work_task_checklists c
      join public.work_tasks t on t.id = c.task_id
      where c.id = checklist_id
        and (has_permission('work.view') or t.owner_user_id = auth.uid()
          or exists (select 1 from public.work_task_assignees a where a.task_id = t.id and a.user_id = auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.work_task_checklists c
      join public.work_tasks t on t.id = c.task_id
      where c.id = checklist_id
        and (has_permission('work.manage') or t.owner_user_id = auth.uid()
          or exists (select 1 from public.work_task_assignees a where a.task_id = t.id and a.user_id = auth.uid()))
    )
  );

drop policy if exists work_task_comments_access on public.work_task_comments;
create policy work_task_comments_access on public.work_task_comments
  for all to authenticated
  using (
    exists (
      select 1 from public.work_tasks t
      where t.id = task_id
        and (has_permission('work.view') or t.owner_user_id = auth.uid()
          or exists (select 1 from public.work_task_assignees a where a.task_id = t.id and a.user_id = auth.uid()))
    )
  )
  with check (
    author_user_id = auth.uid() or has_permission('work.manage')
  );

drop policy if exists work_task_attachments_access on public.work_task_attachments;
create policy work_task_attachments_access on public.work_task_attachments
  for all to authenticated
  using (
    exists (
      select 1 from public.work_tasks t
      where t.id = task_id
        and (has_permission('work.view') or t.owner_user_id = auth.uid()
          or exists (select 1 from public.work_task_assignees a where a.task_id = t.id and a.user_id = auth.uid()))
    )
  )
  with check (uploaded_by = auth.uid() or has_permission('work.manage'));

drop policy if exists work_activity_log_read on public.work_activity_log;
create policy work_activity_log_read on public.work_activity_log
  for select to authenticated
  using (has_permission('work.view') or has_permission('work.manage') or actor_user_id = auth.uid());

drop policy if exists work_activity_log_write on public.work_activity_log;
create policy work_activity_log_write on public.work_activity_log
  for insert to authenticated
  with check (has_permission('work.manage') or actor_user_id = auth.uid());

drop policy if exists work_time_entries_access on public.work_time_entries;
create policy work_time_entries_access on public.work_time_entries
  for all to authenticated
  using (user_id = auth.uid() or has_permission('work.view') or has_permission('work.manage'))
  with check (user_id = auth.uid() or has_permission('work.manage'));

drop policy if exists work_project_risks_access on public.work_project_risks;
create policy work_project_risks_access on public.work_project_risks
  for all to authenticated
  using (
    exists (
      select 1 from public.work_projects p
      where p.id = project_id
        and (has_permission('work.view') or has_permission('work.executive') or p.owner_user_id = auth.uid())
    )
  )
  with check (has_permission('work.manage') or owner_user_id = auth.uid());

drop policy if exists work_status_history_read on public.work_status_history;
create policy work_status_history_read on public.work_status_history
  for select to authenticated
  using (has_permission('work.view') or has_permission('work.manage'));

drop policy if exists work_status_history_write on public.work_status_history;
create policy work_status_history_write on public.work_status_history
  for insert to authenticated
  with check (has_permission('work.manage') or changed_by = auth.uid());

grant select, insert, update, delete on public.work_playbooks to authenticated;
grant select, insert, update, delete on public.work_playbook_steps to authenticated;
grant select, insert, update, delete on public.work_playbook_runs to authenticated;
grant select, insert, update, delete on public.work_projects to authenticated;
grant select, insert, update, delete on public.work_milestones to authenticated;
grant select, insert, update, delete on public.work_tasks to authenticated;
grant select, insert, update, delete on public.work_task_assignees to authenticated;
grant select, insert, update, delete on public.work_task_dependencies to authenticated;
grant select, insert, update, delete on public.work_task_checklists to authenticated;
grant select, insert, update, delete on public.work_checklist_items to authenticated;
grant select, insert, update, delete on public.work_task_comments to authenticated;
grant select, insert, update, delete on public.work_task_attachments to authenticated;
grant select, insert on public.work_activity_log to authenticated;
grant select, insert, update, delete on public.work_time_entries to authenticated;
grant select, insert, update, delete on public.work_project_risks to authenticated;
grant select, insert on public.work_status_history to authenticated;
