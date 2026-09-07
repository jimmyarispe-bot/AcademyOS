import { describe, expect, it } from "vitest";
import {
  buildGoogleConnectAuthorizeUrl,
  parseGoogleOAuthState,
  googleWorkspaceRedirectUri,
} from "@/lib/platform/integrations/connections";

describe("RC-2.01 — Google Workspace OAuth Installation", () => {
  it("builds authorize URL when client credentials are configured", () => {
    const prevId = process.env.GOOGLE_WORKSPACE_CLIENT_ID;
    const prevSecret = process.env.GOOGLE_WORKSPACE_CLIENT_SECRET;
    process.env.GOOGLE_WORKSPACE_CLIENT_ID = "google-client-demo";
    process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = "google-secret-demo";
    process.env.NEXT_PUBLIC_APP_URL = "https://jag.local";

    try {
      const result = buildGoogleConnectAuthorizeUrl({
        organizationId: "org-1",
        userId: "user-1",
      });
      expect("error" in result).toBe(false);
      if ("error" in result) return;
      expect(result.authorizeUrl).toContain("accounts.google.com");
      expect(result.authorizeUrl).toContain("client_id=google-client-demo");
      expect(result.authorizeUrl).toContain(
        encodeURIComponent(googleWorkspaceRedirectUri())
      );
      const parsed = parseGoogleOAuthState(result.state);
      // `mode` defaults to "org" when the caller does not ask for one, so a
      // state issued before the per-user flow existed still parses as the
      // behaviour it was issued for.
      expect(parsed).toEqual({
        organizationId: "org-1",
        userId: "user-1",
        mode: "org",
      });
    } finally {
      process.env.GOOGLE_WORKSPACE_CLIENT_ID = prevId;
      process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = prevSecret;
    }
  });

  it("carries mode through the signed state for a per-user connection", () => {
    const prevId = process.env.GOOGLE_WORKSPACE_CLIENT_ID;
    const prevSecret = process.env.GOOGLE_WORKSPACE_CLIENT_SECRET;
    process.env.GOOGLE_WORKSPACE_CLIENT_ID = "google-client-demo";
    process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = "google-secret-demo";
    process.env.NEXT_PUBLIC_APP_URL = "https://jag.local";

    try {
      const result = buildGoogleConnectAuthorizeUrl({
        organizationId: "org-1",
        userId: "user-1",
        mode: "user",
      });
      expect("error" in result).toBe(false);
      if ("error" in result) return;

      // The org and per-user flows share ONE redirect URI -- which is why the
      // per-user flow needed no new registration in Google Cloud. The mode is
      // what tells the callback which branch to take, so it must survive the
      // round trip intact.
      expect(result.authorizeUrl).toContain(
        encodeURIComponent(googleWorkspaceRedirectUri())
      );
      expect(parseGoogleOAuthState(result.state)).toEqual({
        organizationId: "org-1",
        userId: "user-1",
        mode: "user",
      });
    } finally {
      process.env.GOOGLE_WORKSPACE_CLIENT_ID = prevId;
      process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = prevSecret;
    }
  });

  it("asks for the wide scopes only on the per-user flow", () => {
    const prevId = process.env.GOOGLE_WORKSPACE_CLIENT_ID;
    const prevSecret = process.env.GOOGLE_WORKSPACE_CLIENT_SECRET;
    process.env.GOOGLE_WORKSPACE_CLIENT_ID = "google-client-demo";
    process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = "google-secret-demo";
    process.env.NEXT_PUBLIC_APP_URL = "https://jag.local";

    try {
      const org = buildGoogleConnectAuthorizeUrl({
        organizationId: "org-1",
        userId: "user-1",
      });
      const user = buildGoogleConnectAuthorizeUrl({
        organizationId: "org-1",
        userId: "user-1",
        mode: "user",
      });
      if ("error" in org || "error" in user) throw new Error("expected URLs");

      const orgScopes = decodeURIComponent(
        new URL(org.authorizeUrl).searchParams.get("scope") ?? ""
      ).split(" ");
      const userScopes = decodeURIComponent(
        new URL(user.authorizeUrl).searchParams.get("scope") ?? ""
      ).split(" ");

      // The three that make a personal workspace real. Each is the CONTENT
      // scope, not the metadata one -- gmail.metadata cannot return bodies or
      // search, calendar.readonly cannot create an event, and
      // drive.metadata.readonly returns a file list you cannot open.
      for (const scope of [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/drive.readonly",
      ]) {
        expect(userScopes).toContain(scope);
        // And the org grant must NOT have them. It covers every mailbox in the
        // domain behind one token no individual can revoke, so widening it is
        // a different decision entirely -- one nobody has made.
        expect(orgScopes).not.toContain(scope);
      }

      expect(orgScopes).toContain(
        "https://www.googleapis.com/auth/gmail.metadata"
      );
      // A teacher connecting their own mailbox is not a directory admin.
      expect(userScopes).not.toContain(
        "https://www.googleapis.com/auth/admin.directory.user.readonly"
      );
      expect(orgScopes).toContain(
        "https://www.googleapis.com/auth/admin.directory.user.readonly"
      );
    } finally {
      process.env.GOOGLE_WORKSPACE_CLIENT_ID = prevId;
      process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = prevSecret;
    }
  });

  it("rejects a state whose payload has been tampered with", () => {
    const prevId = process.env.GOOGLE_WORKSPACE_CLIENT_ID;
    const prevSecret = process.env.GOOGLE_WORKSPACE_CLIENT_SECRET;
    process.env.GOOGLE_WORKSPACE_CLIENT_ID = "google-client-demo";
    process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = "google-secret-demo";

    try {
      const result = buildGoogleConnectAuthorizeUrl({
        organizationId: "org-1",
        userId: "user-1",
        mode: "user",
      });
      if ("error" in result) throw new Error("expected a state");

      // THIS is why mode is a signed claim and not a state prefix. The prefix
      // is not covered by the HMAC; the payload is. Editing the payload -- to
      // turn a personal connection into an organisation-wide one, say --
      // invalidates the state instead of silently succeeding.
      const [prefix, payload, sig] = result.state.split(".");
      const claims = JSON.parse(
        Buffer.from(payload as string, "base64url").toString("utf8")
      ) as Record<string, unknown>;
      claims.mode = "org";
      const tampered = Buffer.from(JSON.stringify(claims), "utf8").toString(
        "base64url"
      );

      expect(parseGoogleOAuthState(`${prefix}.${tampered}.${sig}`)).toBeNull();
    } finally {
      process.env.GOOGLE_WORKSPACE_CLIENT_ID = prevId;
      process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = prevSecret;
    }
  });

  it("returns a clear error when OAuth is not configured", () => {
    const prevId = process.env.GOOGLE_WORKSPACE_CLIENT_ID;
    const prevSecret = process.env.GOOGLE_WORKSPACE_CLIENT_SECRET;
    const prevGid = process.env.GOOGLE_CLIENT_ID;
    const prevGsecret = process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_WORKSPACE_CLIENT_ID;
    delete process.env.GOOGLE_WORKSPACE_CLIENT_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    try {
      const result = buildGoogleConnectAuthorizeUrl({
        organizationId: "org-1",
        userId: "user-1",
      });
      expect(result).toMatchObject({ error: expect.stringContaining("not configured") });
    } finally {
      process.env.GOOGLE_WORKSPACE_CLIENT_ID = prevId;
      process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = prevSecret;
      process.env.GOOGLE_CLIENT_ID = prevGid;
      process.env.GOOGLE_CLIENT_SECRET = prevGsecret;
    }
  });
});
