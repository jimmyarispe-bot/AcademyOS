/**
 * Shared between the server action and the client list, which is why it lives
 * alone.
 *
 * `parent-invites.ts` imports the service-role client. A client component
 * importing a constant from there drags server-only code into the browser
 * bundle — the repository's client-boundary check exists to catch exactly that,
 * and it caught this.
 */

/** Nobody is emailed more than this in one call, however many are selected. */
export const PARENT_INVITE_BATCH_LIMIT = 50;
