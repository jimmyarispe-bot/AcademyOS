-- Why 66 students matched no lead. READ ONLY.
--
-- The first census put 66 students -- 58 of them enrolled -- in "nothing on
-- file, no matching lead". That is either a real gap or an artefact of the
-- match rule, which requires school + first + last + date of birth. A roster
-- imported without dates of birth would land every row there regardless of
-- whether the enquiry exists.
--
-- This asks which. Nothing is written.
--
-- Run the whole file for the summary. To see examples, select the second
-- query at the bottom on its own and press Ctrl+Enter.

with no_contact as (
  select st.*
  from public.students st
  left join public.families f on f.id = st.family_id
  where nullif(trim(f.billing_email), '') is null
    and nullif(trim(f.billing_phone), '') is null
    and not exists (
      select 1 from public.guardians g
      where g.family_id = st.family_id
        and (nullif(trim(g.email), '') is not null
             or nullif(trim(g.phone), '') is not null)
    )
),
unmatched as (
  -- Only the students the first census could not match at all.
  select nc.*
  from no_contact nc
  where not exists (
    select 1 from public.admissions_leads l
    where l.school_id = nc.school_id
      and nc.date_of_birth is not null
      and l.date_of_birth = nc.date_of_birth
      and lower(trim(l.first_name)) = lower(trim(nc.first_name))
      and lower(trim(l.last_name))  = lower(trim(nc.last_name))
      and (nullif(trim(l.guardian_email), '') is not null
           or nullif(trim(l.guardian_phone), '') is not null)
  )
),
diagnosed as (
  select
    u.enrollment_status,
    case
      when u.date_of_birth is null
        and exists (
          select 1 from public.admissions_leads l
          where l.school_id = u.school_id
            and lower(trim(l.first_name)) = lower(trim(u.first_name))
            and lower(trim(l.last_name))  = lower(trim(u.last_name))
            and (nullif(trim(l.guardian_email), '') is not null
                 or nullif(trim(l.guardian_phone), '') is not null)
        )
        then 'A. student has no date of birth, but name matches a lead that has contact'
      when u.date_of_birth is null
        then 'B. student has no date of birth, and no lead matches the name either'
      when exists (
          select 1 from public.admissions_leads l
          where l.school_id = u.school_id
            and lower(trim(l.first_name)) = lower(trim(u.first_name))
            and lower(trim(l.last_name))  = lower(trim(u.last_name))
            and l.date_of_birth is distinct from u.date_of_birth
            and (nullif(trim(l.guardian_email), '') is not null
                 or nullif(trim(l.guardian_phone), '') is not null)
        )
        then 'C. name matches a lead in the same school, dates of birth disagree'
      when exists (
          select 1 from public.admissions_leads l
          where l.school_id is distinct from u.school_id
            and l.date_of_birth = u.date_of_birth
            and lower(trim(l.first_name)) = lower(trim(u.first_name))
            and lower(trim(l.last_name))  = lower(trim(u.last_name))
            and (nullif(trim(l.guardian_email), '') is not null
                 or nullif(trim(l.guardian_phone), '') is not null)
        )
        then 'D. name and date of birth match a lead at a DIFFERENT school'
      when exists (
          select 1 from public.admissions_leads l
          where lower(trim(l.first_name)) = lower(trim(u.first_name))
            and lower(trim(l.last_name))  = lower(trim(u.last_name))
        )
        then 'E. a lead with this name exists, but it carries no contact either'
      else 'F. no lead with this name anywhere -- genuinely never in the pipeline'
    end as reason
  from unmatched u
)
select
  reason,
  count(*)                                                as students,
  count(*) filter (where enrollment_status = 'enrolled')  as enrolled
from diagnosed
group by reason
order by reason;


-- ---------------------------------------------------------------------------
-- Examples. Select from here down and press Ctrl+Enter to run on its own.
-- ---------------------------------------------------------------------------
-- select st.last_name, st.first_name, sc.name as school,
--        st.date_of_birth as student_dob, st.enrollment_status,
--        l.date_of_birth  as lead_dob, l.guardian_email, l.guardian_phone
-- from public.students st
-- left join public.schools sc on sc.id = st.school_id
-- left join public.admissions_leads l
--   on lower(trim(l.first_name)) = lower(trim(st.first_name))
--  and lower(trim(l.last_name))  = lower(trim(st.last_name))
-- where st.family_id is null
-- order by st.last_name, st.first_name
-- limit 40;
