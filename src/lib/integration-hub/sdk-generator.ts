import type { createAuthClient } from "@/lib/supabase/server-auth";
import { SDK_LANGUAGES } from "@/lib/integration-hub/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getSdkPackages(supabase: AuthClient) {
  const { data } = await supabase.from("ihub_sdk_packages").select("*").order("language");
  return data?.length ? data : SDK_LANGUAGES.map((s) => ({
    language: s.language,
    package_name: s.package,
    latest_version: "1.0.0",
    architecture_notes: `${s.label} SDK — REST API v1, OAuth 2.0, webhooks`,
  }));
}

export function getSdkArchitecture(language: string) {
  return {
    language,
    transport: "HTTPS REST",
    auth: ["API Key", "OAuth 2.0", "Sandbox Key"],
    features: ["CRUD resources", "Webhook subscriptions", "Event replay", "Rate limit headers"],
    graphqlReady: true,
    tenantIsolation: "organization_id scoped on every request",
  };
}
