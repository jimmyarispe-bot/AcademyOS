/**
 * Google Workspace OAuth 2.0 — uses Sprint 073 platform OAuth helpers.
 */

import {
  buildOAuthAuthorizeUrl,
  createOAuthState,
  type OAuth2Config,
} from "@/lib/platform/integrations/core/oauth";

/**
 * THE ORGANISATION'S GRANT. One connection, made once by an integration admin,
 * used to read things that belong to the school rather than to a person: the
 * directory, the Classroom catalogue.
 *
 * DELIBERATELY NARROW, and it stays narrow even though the per-user list below
 * was widened on 7 September. This grant covers EVERY mailbox in the domain at
 * once. `gmail.metadata` means a bug or a leaked token exposes who emailed whom
 * — not what they said. Widening this to gmail.readonly would put every staff
 * member's correspondence behind a single token that no individual can revoke.
 *
 * It also matches the connector's stated privacy policy (storeEmailBodies:
 * false) and the sync that implements it, which fetches format=metadata.
 */
export const GOOGLE_WORKSPACE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.metadata",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/presentations.readonly",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/tasks.readonly",
  "https://www.googleapis.com/auth/admin.directory.user.readonly",
  "https://www.googleapis.com/auth/admin.directory.group.readonly",
  "https://www.googleapis.com/auth/admin.directory.orgunit.readonly",
  // Google Classroom rides on this same connection rather than a second Google
  // login — one consent screen, one refresh token. An org connected before these
  // were added must reconnect once to grant them; until it does, Classroom calls
  // return 403 and the error says so.
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.students.readonly",
  "https://www.googleapis.com/auth/classroom.student-submissions.students.readonly",
  "https://www.googleapis.com/auth/classroom.profile.emails",
] as const;

/**
 * ONE PERSON'S OWN GRANT — their mail, their calendar, their files.
 *
 * Three scopes differ from the organisation list above, and the difference is
 * the whole point of the per-user flow:
 *
 *   gmail.readonly  (not gmail.metadata)        message BODIES, and search.
 *                   gmail.metadata returns headers only and refuses the `q`
 *                   parameter outright, so an inbox panel built on it can list
 *                   senders and subjects and do nothing else.
 *   calendar        (not calendar.readonly)     create, move and cancel events,
 *                   so scheduling can happen inside JAG instead of alongside it.
 *   drive.readonly  (not drive.metadata.readonly)  open files, not just name
 *                   them. The metadata scope returns a file list you cannot read.
 *
 * NO admin.directory.* HERE. A teacher connecting their own account is not a
 * directory administrator; asking them to consent to reading the whole staff
 * directory would be asking for something they neither need nor can grant.
 * Directory reads belong to the organisation connection.
 *
 * WHY THIS IS SAFE TO WIDEN WHERE THE ORG LIST IS NOT: this grant is one
 * person's, made by that person, revocable by that person from their own Google
 * account, and stored in their own row in user_google_connections. The blast
 * radius of a single compromised token is one mailbox, not the domain.
 *
 * gmail.readonly and drive.readonly are RESTRICTED scopes, which normally means
 * Google verification and a CASA security assessment. The consent screen is
 * INTERNAL — only @theacademyway.org can authorise — and internal apps are
 * exempt. That exemption is the reason the app was configured Internal.
 */
export const GOOGLE_USER_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/presentations.readonly",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/tasks.readonly",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.students.readonly",
  "https://www.googleapis.com/auth/classroom.student-submissions.students.readonly",
  "https://www.googleapis.com/auth/classroom.profile.emails",
] as const;

export type GoogleWorkspaceOAuthConfig = OAuth2Config & {
  readonly clientSecret?: string;
};

export function googleWorkspaceOAuthConfig(input: {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  /** When true, request admin-level consent for domain-wide sync. */
  adminConsent?: boolean;
  /**
   * Which grant this authorize URL is for. Defaults to "org" so every existing
   * caller keeps the scopes it had before the per-user flow existed.
   */
  mode?: "org" | "user";
}): GoogleWorkspaceOAuthConfig & { clientSecret?: string } {
  // Preserve query hints on authorize URL for B4 Integration Center continuity.
  const authorizationUrl = input.adminConsent
    ? "https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&prompt=consent&hd="
    : "https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&prompt=consent";

  const scopes =
    input.mode === "user"
      ? [...GOOGLE_USER_OAUTH_SCOPES]
      : [...GOOGLE_WORKSPACE_OAUTH_SCOPES];

  return {
    clientId: input.clientId,
    authorizationUrl,
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes,
    redirectUri: input.redirectUri,
    clientSecret: input.clientSecret,
  };
}

export function buildGoogleWorkspaceAuthorizeUrl(
  config: GoogleWorkspaceOAuthConfig,
  options: {
    state?: string;
    adminConsent?: boolean;
    loginHint?: string;
    hostedDomain?: string;
  } = {}
): string {
  const state = options.state ?? createOAuthState("google");
  const extra: Record<string, string> = {
    access_type: "offline",
    prompt: "consent",
  };
  if (options.adminConsent) extra.prompt = "consent";
  if (options.loginHint) extra.login_hint = options.loginHint;
  if (options.hostedDomain) extra.hd = options.hostedDomain;

  return buildOAuthAuthorizeUrl(config, { state, extra });
}

export type GoogleWorkspaceDomain = {
  domain: string;
  customerId: string;
  displayName: string;
  adminEmail: string;
};

export type GoogleWorkspaceAuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  domain: string;
  consentType: "admin" | "user";
  domains: GoogleWorkspaceDomain[];
};
