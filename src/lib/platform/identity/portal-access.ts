import type { createAuthClient } from "@/lib/supabase/server-auth";
import { userHasPermission } from "@/lib/platform/identity/permissions";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

/** 16/17 — Parent and student portal access checks */
export async function canAccessParentPortal(supabase: AuthClient, userId: string): Promise<boolean> {
  return userHasPermission(supabase, "portal.parent.access", userId);
}

export async function canAccessStudentPortal(supabase: AuthClient, userId: string): Promise<boolean> {
  return userHasPermission(supabase, "portal.student.access", userId);
}

export async function getParentLinkedStudentIds(
  supabase: AuthClient,
  userId: string
): Promise<string[]> {
  const { data: links } = await supabase
    .from("student_family_link")
    .select("student_id")
    .eq("user_id", userId);

  const { data: guardians } = await supabase
    .from("guardians")
    .select("family_id")
    .eq("user_id", userId);

  const familyIds = guardians?.map((g) => g.family_id) ?? [];
  let familyStudentIds: string[] = [];

  if (familyIds.length) {
    const { data: students } = await supabase
      .from("students")
      .select("id")
      .in("family_id", familyIds);
    familyStudentIds = students?.map((s) => s.id) ?? [];
  }

  const directIds = links?.map((l) => l.student_id) ?? [];
  return [...new Set([...directIds, ...familyStudentIds])];
}

export async function getStudentSelfId(
  supabase: AuthClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.id ?? null;
}

export async function assertParentStudentAccess(
  supabase: AuthClient,
  userId: string,
  studentId: string
): Promise<boolean> {
  const allowedIds = await getParentLinkedStudentIds(supabase, userId);
  return allowedIds.includes(studentId);
}

export async function assertStudentSelfAccess(
  supabase: AuthClient,
  userId: string,
  studentId: string
): Promise<boolean> {
  const selfId = await getStudentSelfId(supabase, userId);
  return selfId === studentId;
}
