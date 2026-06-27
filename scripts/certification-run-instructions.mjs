#!/usr/bin/env node
/**
 * I-01: Full certification must run against a deployed environment with Supabase linked.
 * This script prints the required steps — it does not substitute for the Certification Center UI.
 */
console.log(`
AcademyOS v1.0 Full Certification Run Instructions (I-01)
===========================================================

1. Apply migrations through 131_v1_phase1_seed_password_reset_flag.sql
2. Set production env vars (see .env.example): CRON_SECRET, NEXT_PUBLIC_APP_URL, VAULT_ENCRYPTION_KEY, SENDGRID_API_KEY
3. Sign in as a user with certification.admin permission
4. Open: /dashboard/certification/launch
5. Click "Run full certification"
6. Review Platform Health Report — resolve Critical/High findings
7. Confirm overall score >= 85% OR document accepted exceptions for launch sign-off

CI runs build, lint, typecheck, and Playwright smoke tests only.
Full certification requires live Supabase data and authenticated session.
`);
