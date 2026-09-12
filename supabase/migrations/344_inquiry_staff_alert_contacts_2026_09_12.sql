-- 344_inquiry_staff_alert_contacts_2026_09_12.sql
--
-- The new-inquiry alert carries the family's contact details, and they are
-- tappable.
--
-- WHAT IT SAID BEFORE:
--   "{{student_name}} — new inquiry at {{school_name}}. Parent: {{parent_name}}"
--
-- A name, a school and a parent's name. Not the email address. Not the phone
-- number. So the alert that exists to say "somebody wants to talk to you" gave
-- the reader no way to talk to them — they opened the JAG, found the lead, and
-- read the number off a screen.
--
-- WHAT IT SAYS NOW: the same facts, plus the programme, plus the email address
-- and the phone number as links. Admissions staff read this on a phone as often
-- as at a desk, and a number that has to be retyped into the dialler is a number
-- that gets rung later, or not at all.
--
-- WHY `parent_phone_dial` AND NOT `parent_phone` IN THE HREF. `parent_phone` is
-- what the family typed — "(407) 555-0123" — which is what the reader should
-- see, because it is how that family recognises their own number. A `tel:` href
-- wants the same digits without the decoration; a mail client that cannot parse
-- one silently renders dead text, which looks exactly like a working link until
-- somebody taps it. The new merge field is the normalised copy and belongs only
-- inside the href.
--
-- WHY RAW HTML IN A TEMPLATE BODY. The Resend provider passes the body through
-- as the HTML part, converting newlines to <br> and escaping nothing. That is
-- what makes an anchor work here — and it is also why this body is a single
-- line, because every newline would otherwise become a visible blank.
--
-- Only the global template (`school_id is null`) is touched. A campus that has
-- written its own wording keeps it; this is the default every campus inherits
-- until it does.
--
-- Safe to re-run: the update is conditional on the body still being the old one.

update public.admissions_communication_templates
set body = '<p><strong>{{student_name}}</strong> — new inquiry at {{school_name}}.</p><p>Programme: {{program_name}}</p><p>Parent: {{parent_name}}<br>Email: <a href="mailto:{{parent_email}}">{{parent_email}}</a><br>Phone: <a href="tel:{{parent_phone_dial}}">{{parent_phone}}</a></p>',
    updated_at = now()
where template_key = 'inquiry_staff_alert'
  and channel = 'staff_email'
  and school_id is null
  and body = '{{student_name}} — new inquiry at {{school_name}}. Parent: {{parent_name}}';

-- Expect one row with the new body, and both links present.
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
