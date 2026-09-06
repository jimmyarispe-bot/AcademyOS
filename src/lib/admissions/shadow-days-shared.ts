/**
 * Shapes for the shadow-days screen.
 *
 * Split from the query module because that one reaches `createAuthClient`, and
 * a client component importing it — even for a type — pulls server-only code
 * toward the browser bundle. Same reason `gates/definitions.ts` is client-safe.
 */

export interface ShadowDayCase {
  readonly leadId: string;
  readonly studentName: string;
  readonly guardianName: string | null;
  readonly guardianEmail: string | null;
  readonly guardianPhone: string | null;
  readonly schoolName: string | null;
  readonly grade: string | null;
  /** When the lead entered the system. Not when shadow days were booked. */
  readonly leadCreated: string;
  readonly daysWaiting: number;
}
