import type { createAuthClient } from "@/lib/supabase/server-auth";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getUniversityCourses(supabase: AuthClient, rolePath?: string) {
  let q = supabase.from("ops_university_courses").select("*").order("sort_order");
  if (rolePath) q = q.eq("role_path", rolePath);
  const { data } = await q;
  return data ?? [];
}

export async function getUniversityEnrollments(supabase: AuthClient, userId?: string) {
  let q = supabase.from("ops_university_enrollments").select("*, ops_university_courses(course_name, role_path)").order("created_at", { ascending: false });
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q.limit(50);
  return data ?? [];
}

export async function enrollInCourse(supabase: AuthClient, courseId: string, userId: string) {
  const { data, error } = await supabase
    .from("ops_university_enrollments")
    .insert({ course_id: courseId, user_id: userId, status: "enrolled" })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { enrollmentId: data.id };
}
