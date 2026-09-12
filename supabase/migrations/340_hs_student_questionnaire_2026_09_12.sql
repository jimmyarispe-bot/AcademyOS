-- 340_hs_student_questionnaire_2026_09_12.sql
--
-- The high school's five questions, asked of the student rather than the parent.
--
-- Version 14 removed the "Student Section" from the inquiry form, because a
-- parent typing answers on behalf of a teenager who is not in the room is worth
-- less than asking nobody. The questions themselves were never the problem —
-- the problem was who was holding the keyboard.
--
-- So the student is emailed a link of their own. No account: a fourteen-year-old
-- will not create one, and requiring it would cost more answers than it protects.
--
-- THE TOKEN DESIGN is the one in migration 230, which is the public-link pattern
-- in this codebase that was built properly:
--
--   * 256 bits of randomness, minted in the application
--   * only the SHA-256 digest is stored — a copy of the database yields no
--     working links
--   * resolution and submission go through SECURITY DEFINER functions that fail
--     closed, so `anon` never touches admissions_leads directly
--   * hard expiry, checked in the database rather than in the page
--
-- WHAT THE LINK HANDS BACK, deliberately, is the student's first name and the
-- school's name and nothing else. Not the lead id, not the school id, not the
-- parent's email — nothing a holder of one link could use to go looking for
-- another family.
--
-- THE ANSWER KEYS ARE FIXED HERE as well as in the application. The application
-- decides what to ask; this decides what it is willing to store. A crafted
-- payload naming a sixth key writes nothing, and no single answer can be used to
-- push a megabyte into the row.
--
-- Safe to re-run.

create table if not exists public.admissions_student_questionnaires (
  id uuid primary key default gen_random_uuid(),

  lead_id uuid not null references public.admissions_leads(id) on delete cascade,

  -- Where the link was sent. Kept even after completion: "which address did the
  -- student actually use" is the first question asked when one goes missing.
  student_email text not null,

  -- Digest only. The plaintext token exists in the email and nowhere else.
  token_hash bytea not null unique,

  status text not null default 'sent'
    check (status in ('sent', 'completed', 'expired', 'cancelled')),

  -- {question_key: answer}. The authoritative copy of what the student wrote.
  answers jsonb not null default '{}'::jsonb,

  sent_at timestamptz not null default now(),
  opened_at timestamptz,
  completed_at timestamptz,

  -- Long enough that a student who is away for a fortnight can still answer,
  -- short enough that a forwarded link does not work a year later.
  expires_at timestamptz not null default (now() + interval '45 days'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live link per lead. Two working links for one student makes "did they
-- answer?" unanswerable, and a resend should invalidate what came before.
create unique index if not exists idx_student_questionnaires_one_open
  on public.admissions_student_questionnaires (lead_id)
  where status = 'sent';

create index if not exists idx_student_questionnaires_lead
  on public.admissions_student_questionnaires (lead_id);

comment on column public.admissions_student_questionnaires.token_hash is
  'SHA-256 of the link token. The plaintext is never stored — it lives only in the email that was sent.';

drop trigger if exists set_updated_at_admissions_student_questionnaires
  on public.admissions_student_questionnaires;
create trigger set_updated_at_admissions_student_questionnaires
  before update on public.admissions_student_questionnaires
  for each row execute function public.trigger_set_updated_at();

alter table public.admissions_student_questionnaires enable row level security;

-- Staff only, scoped through the lead's school. Students never touch this table
-- directly; they go through the SECURITY DEFINER functions below.
drop policy if exists admissions_student_questionnaires_staff
  on public.admissions_student_questionnaires;
create policy admissions_student_questionnaires_staff
on public.admissions_student_questionnaires
for all to authenticated
using (
  can_access_school((select l.school_id from public.admissions_leads l where l.id = lead_id))
)
with check (
  can_access_school((select l.school_id from public.admissions_leads l where l.id = lead_id))
);

-- ---------------------------------------------------------------------------
-- Token helper
-- ---------------------------------------------------------------------------

create or replace function public.admissions_student_token_digest(p_token text)
returns bytea
language sql
immutable
set search_path = public
as $$
  select extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'::text);
$$;

-- ---------------------------------------------------------------------------
-- Public: what does this link ask for?
--
-- First name and school only. A student should see their own name and know the
-- link is genuine; nothing here identifies the record behind it.
-- ---------------------------------------------------------------------------

create or replace function public.resolve_student_questionnaire(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash bytea;
  v_row public.admissions_student_questionnaires%rowtype;
  v_first text;
  v_school text;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    raise exception 'student_questionnaire_token_invalid' using errcode = 'invalid_parameter_value';
  end if;

  v_hash := public.admissions_student_token_digest(trim(p_token));

  select * into v_row
  from public.admissions_student_questionnaires q
  where q.token_hash = v_hash
  limit 1;

  if not found then
    raise exception 'student_questionnaire_token_invalid' using errcode = 'invalid_parameter_value';
  end if;

  if v_row.status = 'completed' then
    return jsonb_build_object('status', 'completed');
  end if;

  if v_row.expires_at <= now() then
    raise exception 'student_questionnaire_link_expired' using errcode = 'check_violation';
  end if;

  if v_row.status <> 'sent' then
    raise exception 'student_questionnaire_link_closed' using errcode = 'check_violation';
  end if;

  -- First view stamps the open. It is the only signal that the email arrived
  -- somewhere a person could read it.
  if v_row.opened_at is null then
    update public.admissions_student_questionnaires
    set opened_at = now()
    where id = v_row.id;
  end if;

  select coalesce(nullif(l.preferred_name, ''), l.first_name), s.name
    into v_first, v_school
  from public.admissions_leads l
  left join public.schools s on s.id = l.school_id
  where l.id = v_row.lead_id;

  return jsonb_build_object(
    'status', 'open',
    'student_first_name', coalesce(v_first, ''),
    'school', coalesce(v_school, ''),
    'expires_at', v_row.expires_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Public: accept the answers.
--
-- Five keys, fixed. Anything else in the payload is ignored rather than stored,
-- and each answer is capped — this function runs for anyone holding the link, so
-- it trusts the caller for nothing.
-- ---------------------------------------------------------------------------

create or replace function public.submit_student_questionnaire(p_token text, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash bytea;
  v_row public.admissions_student_questionnaires%rowtype;
  v_allowed text[] := array[
    'hs_student_why_join',
    'hs_student_biggest_challenge',
    'hs_student_principal_change',
    'hs_student_greatness',
    'hs_student_treated_better'
  ];
  v_key text;
  v_value text;
  v_clean jsonb := '{}'::jsonb;
  v_count int := 0;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    raise exception 'student_questionnaire_token_invalid' using errcode = 'invalid_parameter_value';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'student_questionnaire_answers_invalid' using errcode = 'invalid_parameter_value';
  end if;

  v_hash := public.admissions_student_token_digest(trim(p_token));

  select * into v_row
  from public.admissions_student_questionnaires q
  where q.token_hash = v_hash
  for update;

  if not found then
    raise exception 'student_questionnaire_token_invalid' using errcode = 'invalid_parameter_value';
  end if;
  if v_row.status = 'completed' then
    raise exception 'student_questionnaire_link_closed' using errcode = 'check_violation';
  end if;
  if v_row.status <> 'sent' then
    raise exception 'student_questionnaire_link_closed' using errcode = 'check_violation';
  end if;
  if v_row.expires_at <= now() then
    raise exception 'student_questionnaire_link_expired' using errcode = 'check_violation';
  end if;

  foreach v_key in array v_allowed
  loop
    v_value := nullif(btrim(coalesce(p_answers ->> v_key, '')), '');
    if v_value is null then
      continue;
    end if;
    -- A thoughtful answer is a paragraph. Anything past this is not an answer.
    v_clean := v_clean || jsonb_build_object(v_key, left(v_value, 5000));
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'student_questionnaire_answers_empty' using errcode = 'invalid_parameter_value';
  end if;

  update public.admissions_student_questionnaires
  set answers = v_clean,
      status = 'completed',
      completed_at = now()
  where id = v_row.id;

  return jsonb_build_object('status', 'completed', 'answered', v_count);
end;
$$;

revoke all on function public.resolve_student_questionnaire(text) from public;
revoke all on function public.submit_student_questionnaire(text, jsonb) from public;
grant execute on function public.resolve_student_questionnaire(text) to anon, authenticated;
grant execute on function public.submit_student_questionnaire(text, jsonb) to anon, authenticated;

-- Expect the table empty, and both functions present.
select
  (select count(*) from public.admissions_student_questionnaires) as questionnaires,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('resolve_student_questionnaire', 'submit_student_questionnaire',
                        'admissions_student_token_digest')) as functions_created;
