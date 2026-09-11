# JAG Platform Users — edit / deactivate / reactivate / resend setup

Unzip at the **repo root** (`C:\Projects\JAG-GA-CLEAN`). Paths are already correct.

## Files

| File | Status |
|---|---|
| `src/lib/jag-platform/platform-user-admin-shared.ts` | **new** — client-safe constants/types |
| `src/lib/jag-platform/platform-user-admin.ts` | **new** — server logic |
| `src/lib/jag-platform/platform-user-admin-actions.ts` | **new** — server actions |
| `src/components/jag-platform/JagPlatformUsersView.tsx` | **replaces** existing |
| `src/app/jag/(portal)/users/page.tsx` | **replaces** existing |

`platform-users.ts` and `platform-users-actions.ts` are **untouched** — no conflict with
in-flight work on `release/phase1-admissions`.

## No migration

The `users` table has no status column, so deactivation uses Supabase Auth's existing
ban mechanism (`setUserBanned`, already in `authentication/provider.ts`) plus a
`jag_deactivated_at` stamp in `user_metadata`. **No `supabase db push`. No schema change.
No env change.**

## What you get

- **Edit** — first/last name, email (rewrites the auth login identity + profile in
  lockstep), and JAG role (`PLATFORM_OWNER` / `PLATFORM_ADMIN`).
- **Deactivate** — soft delete. Bans the auth identity so sign-in is refused
  immediately; roles, profile row and `platform_security_events` history are all kept.
  Requires typing `DEACTIVATE` to confirm.
- **Reactivate** — clears the ban and the stamp.
- **Resend setup email** — re-fires the JAG-branded recovery mail with
  `reportDelivery: true`, so you get a truthful sent/not-sent answer.
- **Show deactivated** checkbox — deactivated users are hidden by default and stay
  recoverable.

## Guards

- FOUNDER identities cannot be deactivated or re-roled here.
- You cannot deactivate your own account.
- Email collisions are rejected before any write.
- Every mutation writes a `platform_security_events` row with the actor id.

## Verify

```
npx tsc --noEmit
npx eslint src/lib/jag-platform/platform-user-admin*.ts src/components/jag-platform/JagPlatformUsersView.tsx
```

Both were clean when I ran them against this commit.
