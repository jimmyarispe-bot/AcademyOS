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
  it("is not configured until the environment is stated explicitly", () => {
    process.env.SQUARE_ACCESS_TOKEN = "tok";
    process.env.SQUARE_APPLICATION_ID = "app";
    process.env.SQUARE_LOCATION_ID = "loc";
    delete process.env.SQUARE_ENVIRONMENT;

    const cfg = squareConfig();

    // THE POINT. quickbooksClientConfig() treats any value other than the
    // literal "production" as sandbox and reports itself configured -- miss the
    // variable and everything works while reporting test-account figures. For
    // payments that failure is a card that appears charged and never was, so an
    // unstated environment means NOT configured.
    expect(cfg.configured).toBe(false);
    expect(cfg.missing.join(" ")).toContain("SQUARE_ENVIRONMENT");
    // It still defaults to sandbox rather than production: if something ignores
    // `configured`, the safe side is the one where no real money moves.
    expect(cfg.environment).toBe("sandbox");
    expect(cfg.apiBase).toBe("https://connect.squareupsandbox.com");
  });

  it("names every missing variable at once", () => {
    for (const k of KEYS) delete process.env[k];
    const cfg = squareConfig();
    expect(cfg.configured).toBe(false);
    // All four, not just the first — one round trip per missing variable is how
    // a five-minute setup becomes an afternoon.
    expect(cfg.missing).toHaveLength(4);
  });

  it("points at production only on the exact string", () => {
    process.env.SQUARE_ACCESS_TOKEN = "tok";
    process.env.SQUARE_APPLICATION_ID = "app";
    process.env.SQUARE_LOCATION_ID = "loc";

    process.env.SQUARE_ENVIRONMENT = "production";
    expect(squareConfig()).toMatchObject({
      configured: true,
      environment: "production",
      apiBase: "https://connect.squareup.com",
    });

    // Near misses are sandbox, not production. "Production" with a capital P
    // is accepted (case-insensitive); "prod" is not.
    process.env.SQUARE_ENVIRONMENT = "Production";
    expect(squareConfig().environment).toBe("production");

    process.env.SQUARE_ENVIRONMENT = "prod";
    expect(squareConfig()).toMatchObject({ environment: "sandbox", configured: false });
  });
});
