-- =========================================
-- RLS: Universal deadline engine (portal + student + teacher access)
-- =========================================

drop policy if exists compliance_obligations_access on public.compliance_obligations;
create policy compliance_obligations_access on public.compliance_obligations
  for all to authenticated
  using (
    (
      (school_id is null or can_access_school(school_id))
      and (
        has_permission('compliance.view') or has_permission('compliance.manage')
        or owner_user_id = auth.uid() or backup_owner_user_id = auth.uid()
        or reviewer_user_id = auth.uid() or approver_user_id = auth.uid()
      )
    )
    or guardian_user_id = auth.uid()
    or (assignee_type = 'parent' and student_id is not null and is_parent_of_student(student_id))
    or (assignee_type = 'student' and student_id is not null and (
      exists (select 1 from public.students s where s.id = student_id and s.user_id = auth.uid())
      or is_parent_of_student(student_id)
    ))
    or (assignee_type = 'teacher' and employee_id is not null and is_self_employee(employee_id))
  )
  with check (
    (
      (school_id is null or can_access_school(school_id))
      and (
        has_permission('compliance.manage')
        or owner_user_id = auth.uid() or backup_owner_user_id = auth.uid()
      )
    )
    or (
      parent_can_complete = true
      and (
        guardian_user_id = auth.uid()
        or (student_id is not null and is_parent_of_student(student_id))
      )
    )
    or (assignee_type = 'student' and student_id is not null and exists (
      select 1 from public.students s where s.id = student_id and s.user_id = auth.uid()
    ))
    or (assignee_type = 'teacher' and employee_id is not null and is_self_employee(employee_id))
  );
