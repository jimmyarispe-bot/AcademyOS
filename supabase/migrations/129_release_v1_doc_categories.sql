-- V1.0: extend cert_documentation categories for launch guides and readiness report

alter table public.cert_documentation drop constraint if exists cert_documentation_doc_category_check;
alter table public.cert_documentation add constraint cert_documentation_doc_category_check
  check (doc_category in (
    'administrator','teacher','parent','student','finance','hr','executive','support',
    'cloud','developer','api','release_notes','changelog',
    'admissions','implementation','launch'
  ));
