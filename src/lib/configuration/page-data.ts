import { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { canViewConfiguration } from "@/lib/configuration/access";
import { getPrimaryOrganizationId } from "@/lib/configuration/context";
import { getConfigSection } from "@/lib/configuration/sections";
import type { ConfigSectionKey } from "@/lib/configuration/types";
import { redirect } from "next/navigation";

export async function loadConfigPage(sectionKey?: ConfigSectionKey) {
  const ctx = await getIdentityContext();
  if (!ctx || !canViewConfiguration(ctx)) redirect("/dashboard");

  const supabase = await createAuthClient();
  const organizationId = await getPrimaryOrganizationId(supabase);
  if (!organizationId) redirect("/dashboard/admin");

  const config = sectionKey
    ? await getConfigSection(supabase, organizationId, sectionKey)
    : {};

  return { ctx, supabase, organizationId, config };
}
