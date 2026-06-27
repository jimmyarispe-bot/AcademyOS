import { createAuthClient } from "@/lib/supabase/server-auth";

export async function getStudentSiblings(studentId: string) {
  const supabase = await createAuthClient();
  const { data: links } = await supabase
    .from("ssis_student_sibling_links")
    .select("sibling_student_id, relationship_label")
    .eq("student_id", studentId);

  if (!links?.length) return [];

  const siblingIds = links.map((l) => l.sibling_student_id);
  const { data: siblings } = await supabase
    .from("students")
    .select("id, first_name, last_name, grade_level, student_number")
    .in("id", siblingIds);

  const byId = new Map((siblings ?? []).map((s) => [s.id, s]));

  return links.map((link) => ({
    relationship_label: link.relationship_label,
    ...(byId.get(link.sibling_student_id) ?? { id: link.sibling_student_id }),
  }));
}

export async function getFamilyHouseholds(familyId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("family_households")
    .select("*")
    .eq("family_id", familyId)
    .order("is_primary", { ascending: false });
  return data ?? [];
}

export async function getGuardiansWithDetails(familyId: string) {
  const supabase = await createAuthClient();
  const { data } = await supabase
    .from("guardians")
    .select("*")
    .eq("family_id", familyId)
    .order("is_primary", { ascending: false });
  return data ?? [];
}
