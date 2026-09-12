-- 347_inquiry_thank_you_learning_environment_2026_09_12.sql
--
-- The inquiry thank-you tells the family why we want to talk, not just that we
-- do.
--
-- Adds, to both parent-facing templates:
--
--   "We would love to hear what you are looking for in a learning environment
--    for your child."
--
-- WHERE IT GOES, AND WHY. There are two templates and they say different
-- things, so the sentence lands in a different place in each.
--
--   `inquiry_thank_you_email` carries the booking link: "The next step is a
--   conversation. Please pick a time that suits you: {{scheduling_link}}". The
--   sentence goes between those two — it turns "book a slot" into a reason to
--   book one, and it reaches the parent before the link rather than after it,
--   which is where somebody stops reading.
--
--   `inquiry_thank_you_email_no_link` has no link; the campus contact gets in
--   touch. There the sentence goes immediately before "If it is easier, simply
--   reply to this email", so that an invitation to write back follows a reason
--   to write back.
--
-- WHY `replace` AND NOT A NEW BODY. These bodies were read out of the database
-- through a grid that truncates, so parts of them were inferred rather than
-- seen. Rewriting the whole body would mean retyping sentences nobody has read
-- in full — which is how wording gets quietly changed while a migration reports
-- success. An insertion anchored on a phrase that *was* read in full changes
-- exactly what it says it changes and leaves the rest untouched.
--
-- Migration 344 was the lesson: a guard pinned to an em dash matched nothing and
-- reported success. The anchors here are plain ASCII sentences.
--
-- RE-RUNNABLE: guarded on the sentence not already being present.

update public.admissions_communication_templates
set body = replace(
      body,
      'The next step is a conversation. ',
      'The next step is a conversation. We would love to hear what you are looking for in a learning environment for your child. '
    ),
    updated_at = now()
where template_key = 'inquiry_thank_you_email'
  and channel = 'email'
  and body like '%The next step is a conversation. %'
  and body not like '%learning environment for your child%';

update public.admissions_communication_templates
set body = replace(
      body,
      'If it is easier, simply reply to this email.',
      'We would love to hear what you are looking for in a learning environment for your child. If it is easier, simply reply to this email.'
    ),
    updated_at = now()
where template_key = 'inquiry_thank_you_email_no_link'
  and channel = 'email'
  and body like '%If it is easier, simply reply to this email.%'
  and body not like '%learning environment for your child%';

-- Expect both rows true. A false means the anchor phrase was not where it was
-- read to be, and that template still says what it said yesterday.
select
  template_key,
  coalesce(school_id::text, 'global') as scope,
  is_active,
  body like '%learning environment for your child%' as has_sentence,
  body
from public.admissions_communication_templates
where trigger_event = 'inquiry_submitted'
  and channel = 'email'
order by template_key;
