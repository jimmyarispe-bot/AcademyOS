import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The mapping is the part a human checked. A reconnect must not undo it.
 *
 * Five QuickBooks books arrive as 'unassigned' because Intuit's company picker
 * chooses the realm, not JAG. Someone then confirms which book is The Academy
 * GA. If re-authorising that book rewrote scope back to 'unassigned' -- or
 * worse, wrote a guessed school_id -- one entity's financials would file under
 * another while the screen looked entirely confident.
 */

type Captured = {
  inserts: Record<string, unknown>[];
  updates: Record<string, unknown>[];
};

const captured: Captured = { inserts: [], updates: [] };
let existingRow: Record<string, unknown> | null = null;

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: existingRow, error: null }),
          }),
          order: async () => ({ data: [], error: null }),
        }),
      }),
      insert: (row: Record<string, unknown>) => {
        captured.inserts.push(row);
        return {
          select: () => ({
            single: async () => ({ data: { id: "new-id" }, error: null }),
          }),
        };
      },
      update: (row: Record<string, unknown>) => {
        captured.updates.push(row);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));

vi.mock("@/lib/integration-hub/vault-crypto", () => ({
  encryptCredentialSecret: (s: string) => `enc:${s}`,
  decryptCredentialSecret: (s: string) => s.replace(/^enc:/, ""),
}));

const { saveQuickBooksConnection } = await import(
  "@/lib/connectors/quickbooks/persistence"
);

const TOKENS = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  expiresAt: "2026-09-07T18:00:00.000Z",
  refreshTokenExpiresAt: "2026-12-16T18:00:00.000Z",
  realmId: "9130350000000",
  companyName: "The Academy GA LLC",
  environment: "production" as const,
};

describe("QuickBooks connection persistence", () => {
  beforeEach(() => {
    captured.inserts = [];
    captured.updates = [];
    existingRow = null;
  });

  it("lands a brand new book as unassigned rather than guessing an entity", async () => {
    const result = await saveQuickBooksConnection({
      organizationId: "org-1",
      userId: "user-1",
      tokens: TOKENS,
    });

    expect(result).toMatchObject({ ok: true, created: true });
    expect(captured.inserts).toHaveLength(1);
    expect(captured.updates).toHaveLength(0);

    const row = captured.inserts[0]!;
    expect(row.scope).toBe("unassigned");
    expect(row.school_id).toBeNull();
    expect(row.status).toBe("connected");
    // Ciphertext, never the raw Intuit token.
    expect(row.access_token).toBe("enc:access-1");
    expect(row.refresh_token).toBe("enc:refresh-1");
    expect(row.access_token).not.toBe(TOKENS.accessToken);
    // Intuit sends this on every exchange and it was previously discarded.
    expect(row.refresh_token_expires_at).toBe(TOKENS.refreshTokenExpiresAt);
  });

  it("re-authorising a mapped book leaves its mapping alone", async () => {
    existingRow = {
      id: "conn-ga",
      organization_id: "org-1",
      realm_id: TOKENS.realmId,
      scope: "school",
      school_id: "a1000000-0000-4000-8000-000000000002",
      status: "connected",
    };

    const result = await saveQuickBooksConnection({
      organizationId: "org-1",
      userId: "user-1",
      tokens: { ...TOKENS, accessToken: "access-2", refreshToken: "refresh-2" },
    });

    expect(result).toMatchObject({ ok: true, created: false, id: "conn-ga" });
    expect(captured.inserts).toHaveLength(0);
    expect(captured.updates).toHaveLength(1);

    const patch = captured.updates[0]!;
    // THE POINT OF THIS TEST. An upsert would have to name every column,
    // including scope, and would reset a confirmed mapping to 'unassigned' on
    // every reconnect. These keys must be absent, not merely unchanged.
    expect(Object.keys(patch)).not.toContain("scope");
    expect(Object.keys(patch)).not.toContain("school_id");
    // Tokens still roll forward.
    expect(patch.access_token).toBe("enc:access-2");
    expect(patch.refresh_token).toBe("enc:refresh-2");
    expect(patch.status).toBe("connected");
    expect(patch.last_sync_error).toBeNull();
  });
});
