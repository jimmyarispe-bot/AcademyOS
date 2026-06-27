import type { createAuthClient } from "@/lib/supabase/server-auth";
import { getIdentityContext } from "@/lib/platform/identity/context";
import { userHasPermission } from "@/lib/platform/identity/permissions";
import type { GlobalSearchResult } from "@/lib/platform/identity/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

/** 27 — Permission-filtered global search; users cannot discover unauthorized records */
export async function globalSearch(
  supabase: AuthClient,
  query: string,
  limit = 20
): Promise<GlobalSearchResult[]> {
  const ctx = await getIdentityContext();
  if (!ctx) return [];

  const allowed = await userHasPermission(supabase, "search.global", ctx.effectiveUserId);
  if (!allowed && !ctx.roles.includes("FOUNDER") && !ctx.roles.includes("CEO")) {
    return [];
  }

  const term = query.trim();
  if (term.length < 2) return [];

  const results: GlobalSearchResult[] = [];
  const pattern = `%${term}%`;
  const schoolFilter = ctx.accessibleSchoolIds;

  if (ctx.permissions.includes("students.view") || ctx.roles.some((r) => ["FOUNDER", "CEO", "EXECUTIVE_DIRECTOR"].includes(r))) {
    let studentQuery = supabase
      .from("students")
      .select("id, first_name, last_name, school_id, schools(name)")
      .or(`first_name.ilike.${pattern},last_name.ilike.${pattern}`)
      .limit(limit);

    if (schoolFilter.length) studentQuery = studentQuery.in("school_id", schoolFilter);

    const { data: students } = await studentQuery;
    for (const s of students ?? []) {
      const school = Array.isArray(s.schools) ? s.schools[0] : s.schools;
      results.push({
        id: s.id,
        module: "sis",
        entityType: "student",
        title: `${s.first_name} ${s.last_name}`,
        subtitle: (school as { name?: string } | null)?.name ?? "Student",
        href: `/dashboard/students/${s.id}`,
        classification: "internal",
      });
    }
  }

  if (ctx.permissions.includes("admissions.view")) {
    let leadQuery = supabase
      .from("admissions_leads")
      .select("id, first_name, last_name, school_id, schools(name)")
      .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(limit);

    if (schoolFilter.length) leadQuery = leadQuery.in("school_id", schoolFilter);

    const { data: leads } = await leadQuery;
    for (const l of leads ?? []) {
      const school = Array.isArray(l.schools) ? l.schools[0] : l.schools;
      results.push({
        id: l.id,
        module: "admissions",
        entityType: "lead",
        title: `${l.first_name} ${l.last_name}`,
        subtitle: (school as { name?: string } | null)?.name ?? "Lead",
        href: `/dashboard/admissions/leads/${l.id}`,
        classification: "confidential",
      });
    }
  }

  if (ctx.permissions.includes("hr.view") || ctx.permissions.includes("directory.view")) {
    let empQuery = supabase
      .from("employees")
      .select("id, school_id, employee_profiles(display_name, first_name, last_name), schools(name)")
      .eq("employment_status", "active")
      .limit(limit);

    if (schoolFilter.length) empQuery = empQuery.in("school_id", schoolFilter);

    const { data: employees } = await empQuery;
    for (const e of employees ?? []) {
      const profile = Array.isArray(e.employee_profiles) ? e.employee_profiles[0] : e.employee_profiles;
      const school = Array.isArray(e.schools) ? e.schools[0] : e.schools;
      const name =
        (profile as { display_name?: string; first_name?: string; last_name?: string } | null)?.display_name ??
        [(profile as { first_name?: string } | null)?.first_name, (profile as { last_name?: string } | null)?.last_name]
          .filter(Boolean)
          .join(" ");

      if (!name?.toLowerCase().includes(term.toLowerCase())) continue;

      results.push({
        id: e.id,
        module: "hr",
        entityType: "employee",
        title: name,
        subtitle: (school as { name?: string } | null)?.name ?? "Staff",
        href: `/dashboard/hr`,
        classification: "internal",
      });
    }
  }

  return results.slice(0, limit);
}
