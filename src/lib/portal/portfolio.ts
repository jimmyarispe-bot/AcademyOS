import type { createAuthClient } from "@/lib/supabase/server-auth";
import { searchEvidenceLibrary } from "@/lib/instruction/evidence";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getStudentPortfolio(
  supabase: AuthClient,
  studentId: string,
  view: "chronological" | "subject" = "chronological"
) {
  const artifacts = await searchEvidenceLibrary(supabase, { studentId });

  if (view === "subject") {
    const bySubject: Record<string, typeof artifacts> = {};
    for (const a of artifacts) {
      const subject = a.subject_domain ?? "general";
      bySubject[subject] = [...(bySubject[subject] ?? []), a];
    }
    return { view, bySubject, artifacts };
  }

  return { view, artifacts, bySubject: null };
}
