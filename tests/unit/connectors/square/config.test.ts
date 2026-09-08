import { afterEach, describe, expect, it } from "vitest";
import { squareConfig } from "@/lib/connectors/square/config";

const KEYS = [
  "SQUARE_ACCESS_TOKEN",
  "SQUARE_APPLICATION_ID",
  "SQUARE_LOCATION_ID",
  "SQUARE_ENVIRONMENT",
] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("Square configuration", () => {
  it("needs only the access token", () => {
    for (const k of KEYS) delete process.env[k];
    process.env.SQUARE_ACCESS_TOKEN = "tok";

    const cfg = squareConfig();

    // THE POINT, learned the hard way on 7 September. Requiring
    // SQUARE_ENVIRONMENT cost an evening: it was set in Vercel, scoped
    // correctly and redeployed repeatedly, while the variables beside it
    // arrived fine and it did not. A token already knows its own environment
    // and Square will say so, and asking a person to retype that into a field
    // they cannot read back adds a way to be wrong and no information.
    expect(cfg.configured).toBe(true);
    expect(cfg.missing).toHaveLength(0);
    expect(cfg.pinnedEnvironment).toBeNull();
  });

  it("says what is missing when the token is absent", () => {
    for (const k of KEYS) delete process.env[k];
    expect(squareConfig()).toMatchObject({
      configured: false,
      missing: ["SQUARE_ACCESS_TOKEN"],
    });
  });

  it("pins the environment only on an exact value", () => {
    process.env.SQUARE_ACCESS_TOKEN = "tok";

    process.env.SQUARE_ENVIRONMENT = "production";
    expect(squareConfig().pinnedEnvironment).toBe("production");

    process.env.SQUARE_ENVIRONMENT = "  Sandbox  ";
    expect(squareConfig().pinnedEnvironment).toBe("sandbox");

    // Anything else is not an error any more -- it simply means "unpinned",
    // and the client discovers the environment instead of refusing to start.
    process.env.SQUARE_ENVIRONMENT = "prod";
    expect(squareConfig()).toMatchObject({ pinnedEnvironment: null, configured: true });
  });
});
