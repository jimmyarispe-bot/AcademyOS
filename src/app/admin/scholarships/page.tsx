import { redirect } from "next/navigation";

/** Legacy route — redirects to the secured dashboard scholarships module. */
export default function LegacyScholarshipAdminRedirect() {
  redirect("/dashboard/scholarships");
}
