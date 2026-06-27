import { createAuthClient } from "@/lib/supabase/server-auth";

export async function getOrganizationHierarchy() {
  const supabase = await createAuthClient();

  const { data: org } = await supabase
    .from("org_organizations")
    .select("*")
    .eq("slug", "the-academy-way")
    .maybeSingle();

  const { data: regions } = await supabase
    .from("org_regions")
    .select("*")
    .order("name");

  const { data: schools } = await supabase
    .from("schools")
    .select("id, name, organization_id, region_id, timezone")
    .order("name");

  const { data: campuses } = await supabase
    .from("campuses")
    .select("id, school_id, name, code, is_primary, status")
    .order("name");

  const { data: programs } = await supabase
    .from("org_programs")
    .select("id, school_id, name, code, status")
    .order("name");

  const { data: departments } = await supabase
    .from("org_departments")
    .select("id, school_id, campus_id, name, code, status")
    .order("name");

  return {
    organization: org,
    regions: regions ?? [],
    schools: schools ?? [],
    campuses: campuses ?? [],
    programs: programs ?? [],
    departments: departments ?? [],
  };
}

export async function getSchoolConfiguration(schoolId: string) {
  const supabase = await createAuthClient();

  const [settings, branding, businessHours] = await Promise.all([
    supabase.from("school_settings").select("*").eq("school_id", schoolId).maybeSingle(),
    supabase.from("school_branding").select("*").eq("school_id", schoolId).maybeSingle(),
    supabase
      .from("platform_business_hours")
      .select("*")
      .eq("school_id", schoolId)
      .eq("is_active", true),
  ]);

  return {
    settings: settings.data,
    branding: branding.data,
    businessHours: businessHours.data ?? [],
  };
}
