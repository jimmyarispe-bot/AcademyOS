-- 323_interest_form_v3_2026_09_11.sql
--
-- Version 3 of the Express Interest form.
--
-- WHY. The four campus applications — FL, GA, HS and The Academy Way (Virtual)
-- — ask three things inconsistently. Each campus asks at least one of them and
-- no campus asks all three:
--
--   * Birthdate.       FL, GA and Virtual ask for it. HS asks for an AGE, from
--                      a dropdown, which is stale the day after it is answered.
--   * Mailing address.  All four ask, but only as part of a guardian block, and
--                      JAG's form asked for no address at all.
--   * How did you hear. Only GA asks, as ten checkboxes. JAG had a free-text
--                      "Referral source" box.
--
-- All three are now asked of every family, once, in the shared part of the form.
--
-- CHANGES FROM VERSION 2
--
--   1. `date_of_birth` is unchanged — it was already present and required. It
--      stays the stored fact. AGE IS NOT STORED. A stored age is wrong within a
--      year and there is no way to tell from the row whether it ever was right.
--      The renderer computes it from the birthdate and shows it beside the
--      field; every other screen that wants an age does the same. The form
--      engine has no computed field type and does not need one for this.
--
--   2. New section `mailing_address`, six questions. Street line 2 is the only
--      optional one, matching all four paper forms. Country defaults to United
--      States, which is what every one of them pre-selects.
--
--   3. `referral_source` changes from free text to a multiselect carrying the
--      ten options from the GA form verbatim — including "Returning Student",
--      which is odd as a referral source but is what the form says, and the
--      brief is to add nothing and remove nothing.
--
--      The key and the `lead.referral_source` binding are unchanged, so
--      everything downstream that reads that column keeps working. The value
--      arriving there is now a list; `encodeLeadReferralExtras` is updated in
--      the same ship to join it readably instead of relying on String(array).
--
-- WHAT THIS DOES NOT DO. No campus-conditional sections yet. Those are the next
-- version and a bigger review surface: FL's Step Up award ID, GA's four
-- scholarship programmes and its new-versus-returning branching, HS's
-- student-authored section and video, Virtual's tutoring tracks. This migration
-- is only the shared trunk, so it can be read in one sitting and reverted on
-- its own.
--
-- Version 2 is archived, not deleted: submissions reference their form version,
-- and an archived version keeps answers already collected interpretable.
--
-- Safe to re-run. The guard is the content hash: if a published version with
-- this exact definition already exists for an organization, that organization
-- is skipped.

do $$
declare
  form record;
  new_version_id uuid;
  next_number int;
  definition jsonb;
  hash text;
begin
  definition := $json$
  {
    "schemaVersion": "interest_form.v1",
    "title": "Express Interest",
    "sections": [
      {
        "key": "student",
        "title": "Student Information",
        "description": "Tell us about the student you would like to enroll.",
        "order": 0,
        "questionKeys": [
          "first_name",
          "last_name",
          "preferred_name",
          "date_of_birth",
          "current_grade",
          "applying_for_grade"
        ]
      },
      {
        "key": "program_school",
        "title": "Program & School",
        "order": 1,
        "questionKeys": [
          "school_id",
          "program",
          "referral_source",
          "student_greatness",
          "student_challenges"
        ]
      },
      {
        "key": "guardian",
        "title": "Parent / Guardian Contact",
        "description": "Use the email you will sign in with to access your admissions portal.",
        "order": 2,
        "questionKeys": [
          "guardian_first_name",
          "guardian_last_name",
          "guardian_email",
          "guardian_phone",
          "preferred_contact_method"
        ]
      },
      {
        "key": "mailing_address",
        "title": "Mailing Address",
        "description": "Where we should send anything that goes in the post.",
        "order": 3,
        "questionKeys": [
          "mailing_street",
          "mailing_line_2",
          "mailing_city",
          "mailing_state",
          "mailing_postal_code",
          "mailing_country"
        ]
      }
    ],
    "questions": [
      {
        "key": "first_name",
        "type": "text",
        "label": "First Name",
        "required": true,
        "order": 0,
        "systemBinding": "lead.first_name"
      },
      {
        "key": "last_name",
        "type": "text",
        "label": "Last Name",
        "required": true,
        "order": 1,
        "systemBinding": "lead.last_name"
      },
      {
        "key": "preferred_name",
        "type": "text",
        "label": "Preferred Name",
        "required": true,
        "order": 2,
        "systemBinding": "lead.preferred_name"
      },
      {
        "key": "date_of_birth",
        "type": "date",
        "label": "Date of Birth",
        "required": true,
        "order": 3,
        "systemBinding": "lead.date_of_birth",
        "helpText": "We calculate your child's age from this, so you only tell us once."
      },
      {
        "key": "current_grade",
        "type": "select",
        "label": "Current Grade",
        "required": true,
        "order": 4,
        "systemBinding": "lead.current_grade",
        "optionSource": "grades"
      },
      {
        "key": "applying_for_grade",
        "type": "select",
        "label": "Applying For Grade",
        "required": true,
        "order": 5,
        "systemBinding": "lead.applying_for_grade",
        "optionSource": "grades"
      },
      {
        "key": "school_id",
        "type": "school_selector",
        "label": "School",
        "required": true,
        "order": 6,
        "systemBinding": "lead.school_id"
      },
      {
        "key": "program",
        "type": "program_selector",
        "label": "Program",
        "required": true,
        "order": 7,
        "systemBinding": "lead.program"
      },
      {
        "key": "referral_source",
        "type": "multiselect",
        "label": "How did you hear about our school?",
        "required": true,
        "order": 8,
        "systemBinding": "lead.referral_source",
        "helpText": "Check all that apply.",
        "options": [
          { "value": "returning_student", "label": "Returning Student" },
          { "value": "facebook", "label": "Facebook" },
          { "value": "instagram", "label": "Instagram" },
          { "value": "billboard", "label": "Billboard" },
          { "value": "friend", "label": "Friend" },
          { "value": "tshirts", "label": "Kids wearing tshirts around town" },
          { "value": "bumper_sticker", "label": "Car bumper sticker" },
          { "value": "current_student", "label": "Current student" },
          { "value": "sidewalk_sign", "label": "Sidewalk sign" },
          { "value": "internet_search", "label": "Internet search" }
        ]
      },
      {
        "key": "student_greatness",
        "type": "rich_text",
        "label": "What is your child's GREATNESS?",
        "required": true,
        "order": 9,
        "systemBinding": null
      },
      {
        "key": "student_challenges",
        "type": "rich_text",
        "label": "What challenges does your child experience in school (academically, socially, and/or emotionally)?",
        "required": true,
        "order": 10,
        "systemBinding": null
      },
      {
        "key": "guardian_first_name",
        "type": "text",
        "label": "First Name",
        "required": true,
        "order": 11,
        "systemBinding": "lead.guardian_first_name"
      },
      {
        "key": "guardian_last_name",
        "type": "text",
        "label": "Last Name",
        "required": true,
        "order": 12,
        "systemBinding": "lead.guardian_last_name"
      },
      {
        "key": "guardian_email",
        "type": "email",
        "label": "Email",
        "required": true,
        "order": 13,
        "systemBinding": "lead.guardian_email"
      },
      {
        "key": "guardian_phone",
        "type": "phone",
        "label": "Phone",
        "required": true,
        "order": 14,
        "systemBinding": "lead.guardian_phone"
      },
      {
        "key": "preferred_contact_method",
        "type": "select",
        "label": "Preferred contact method",
        "required": true,
        "order": 15,
        "systemBinding": null,
        "options": [
          { "value": "email", "label": "Email" },
          { "value": "phone", "label": "Phone" },
          { "value": "text", "label": "Text" }
        ],
        "defaultValue": "email"
      },
      {
        "key": "mailing_street",
        "type": "text",
        "label": "Street Address",
        "required": true,
        "order": 16,
        "systemBinding": null
      },
      {
        "key": "mailing_line_2",
        "type": "text",
        "label": "Address Line 2",
        "required": false,
        "order": 17,
        "systemBinding": null
      },
      {
        "key": "mailing_city",
        "type": "text",
        "label": "City",
        "required": true,
        "order": 18,
        "systemBinding": null
      },
      {
        "key": "mailing_state",
        "type": "text",
        "label": "State / Region / Province",
        "required": true,
        "order": 19,
        "systemBinding": null
      },
      {
        "key": "mailing_postal_code",
        "type": "text",
        "label": "Postal / Zip Code",
        "required": true,
        "order": 20,
        "systemBinding": null
      },
      {
        "key": "mailing_country",
        "type": "text",
        "label": "Country",
        "required": true,
        "order": 21,
        "systemBinding": null,
        "defaultValue": "United States"
      }
    ]
  }
  $json$::jsonb;

  hash := encode(sha256(convert_to(definition::text, 'UTF8')), 'hex');

  for form in
    select f.id, f.organization_id
    from public.admissions_interest_forms f
  loop
    -- Already on this exact definition; nothing to do.
    if exists (
      select 1
      from public.admissions_interest_form_versions v
      where v.form_id = form.id
        and v.content_hash = hash
        and v.lifecycle = 'published'
    ) then
      continue;
    end if;

    -- One published version per form is enforced by a partial unique index,
    -- so the incumbent has to step down before the new one is inserted.
    update public.admissions_interest_form_versions
    set lifecycle = 'archived'
    where form_id = form.id
      and lifecycle = 'published';

    select coalesce(max(version_number), 0) + 1
    into next_number
    from public.admissions_interest_form_versions
    where form_id = form.id;

    insert into public.admissions_interest_form_versions (
      form_id,
      organization_id,
      version_number,
      lifecycle,
      schema_version,
      definition,
      content_hash,
      published_at
    )
    values (
      form.id,
      form.organization_id,
      next_number,
      'published',
      'interest_form.v1',
      definition,
      hash,
      now()
    )
    returning id into new_version_id;

    update public.admissions_interest_forms
    set published_version_id = new_version_id,
        updated_at = now()
    where id = form.id;
  end loop;
end $$;

-- What is now live, per organization. Expect one row per form, version 3,
-- lifecycle published, 22 questions.
select
  o.name as organization,
  f.title,
  v.version_number,
  v.lifecycle,
  v.published_at,
  jsonb_array_length(v.definition -> 'questions') as question_count,
  jsonb_array_length(v.definition -> 'sections') as section_count
from public.admissions_interest_forms f
join public.admissions_interest_form_versions v on v.id = f.published_version_id
left join public.org_organizations o on o.id = f.organization_id
order by o.name;
