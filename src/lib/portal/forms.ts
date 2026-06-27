import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getPortalForms(supabase: AuthClient, schoolIds: string[]) {
  if (!schoolIds.length) return { templates: [], submissions: [] };

  const [templates, submissions] = await Promise.all([
    supabase
      .from("portal_form_templates")
      .select("*")
      .in("school_id", schoolIds)
      .eq("is_active", true)
      .order("title"),
    supabase
      .from("portal_form_submissions")
      .select("*, portal_form_templates(title, form_type)")
      .order("submitted_at", { ascending: false })
      .limit(30),
  ]);

  return {
    templates: templates.data ?? [],
    submissions: submissions.data ?? [],
  };
}
