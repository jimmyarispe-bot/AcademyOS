insert into prospects (
  id,
  school_id,
  first_name,
  last_name,
  status
)
values (
  gen_random_uuid(),
  (select id from schools limit 1),
  'Test',
  'Student',
  'Inquiry'
)
returning id;