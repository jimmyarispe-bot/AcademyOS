-- 345_inquiry_staff_alert_contacts_retry_2026_09_12.sql
--
-- Migration 344 did nothing. This is 344 with a guard that works.
--
-- WHY 344 MATCHED NOTHING. It updated only where the body equalled the old text
-- exactly, and that text contains an em dash. Somewhere between the file and
-- the database the character stopped being byte-identical — a different dash,
-- an encoding step in the paste, it does not matter which. The guard was
-- checking punctuation in order to establish a fact about content, which is a
-- bad trade: it fails closed and silently, and a migration that reports success
-- while changing nothing is the worst kind.
--
-- THE GUARD NOW is "this body has no mailto: in it". That is the actual
-- condition — the point of this migration is to add contact links, so a body
-- that already has them is already done. It is re-runnable for the same reason,
-- and it does not care what characters the old wording used.
--
-- WHAT IT REPLACES. Only the global row (`school_id is null`), whose entire
-- body today is a name, a school and a parent's name. A campus that has written
-- its own wording has its own row and keeps it.
--
-- Safe to re-run.

update public.admissions_communication_templates
set body = '<p><strong>{{student_name}}</strong> — new inquiry at {{school_name}}.</p><p>Programme: {{program_name}}</p><p>Parent: {{parent_name}}<br>Email: <a href="mailto:{{parent_email}}">{{parent_email}}</a><br>Phone: <a href="tel:{{parent_phone_dial}}">{{parent_phone}}</a></p>',
    updated_at = now()
where template_key = 'inquiry_staff_alert'
  and channel = 'staff_email'
  and school_id is null
  and body not like '%mailto:%';

-- Expect has_email_link and has_phone_link both true.
select
  template_key,
  channel,
  coalesce(school_id::text, 'global') as scope,
  is_active,
  body like '%mailto:%' as has_email_link,
  body like '%tel:%' as has_phone_link,
  body
from public.admissions_communication_templates
where template_key = 'inquiry_staff_alert';
