import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireOperationsPermission } from "@/lib/operations-platform/page-guard";
import { getUniversityCourses, getUniversityEnrollments } from "@/lib/operations-platform/university";
import { OpsShell } from "@/components/operations-platform/OpsNav";
import { OpsTable } from "@/components/operations-platform/OpsPanels";
import { enrollCourseAction } from "@/lib/operations-platform/actions";
import { UNIVERSITY_ROLE_PATHS } from "@/lib/operations-platform/types";

export default async function OperationsUniversityPage() {
  await requireOperationsPermission(["operations.view"]);
  const supabase = await createAuthClient();
  const [courses, enrollments] = await Promise.all([getUniversityCourses(supabase), getUniversityEnrollments(supabase)]);

  return (
    <OpsShell title="AcademyOS University" subtitle="Role-based learning paths — certifications, required courses, renewals, continuing education">
      <p className="text-sm text-slate-600">Role paths: {UNIVERSITY_ROLE_PATHS.join(", ")}</p>
      <OpsTable rows={courses} columns={[
        { key: "course_name", label: "Course" }, { key: "role_path", label: "Role" },
        { key: "is_required", label: "Required" }, { key: "certification_credits", label: "Credits" },
        { key: "renewal_months", label: "Renewal (mo)" },
      ]} />
      {courses.slice(0, 3).map((c) => (
        <form key={c.id} action={enrollCourseAction}>
          <input type="hidden" name="course_id" value={c.id} />
          <button type="submit" className="mr-2 rounded bg-indigo-100 px-3 py-1 text-xs text-indigo-800">Enroll: {c.course_name}</button>
        </form>
      ))}
      <h2 className="font-semibold">Enrollments</h2>
      <OpsTable rows={enrollments} columns={[
        { key: "status", label: "Status" }, { key: "progress_pct", label: "Progress" },
        { key: "certified_at", label: "Certified" }, { key: "expires_at", label: "Expires" },
      ]} />
    </OpsShell>
  );
}
