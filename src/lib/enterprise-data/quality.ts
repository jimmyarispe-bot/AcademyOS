import type { createAuthClient } from "@/lib/supabase/server-auth";
import type { DataQualityReport } from "@/lib/enterprise-data/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function computeQualitySnapshot(
  supabase: AuthClient,
  organizationId: string,
  schoolId?: string
): Promise<DataQualityReport> {
  let studentQuery = supabase.from("students").select("id, first_name, last_name, email");
  if (schoolId) studentQuery = studentQuery.eq("school_id", schoolId);
  const { data: students } = await studentQuery.limit(2000);

  const nameCounts = new Map<string, number>();
  for (const s of students ?? []) {
    const key = `${s.first_name}|${s.last_name}`.toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }
  const duplicateStudents = [...nameCounts.values()].filter((c) => c > 1).length;

  const { count: missingContacts } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .is("email", null);

  const issues = [];
  if (duplicateStudents > 0) {
    issues.push({
      severity: "warning" as const,
      message: `${duplicateStudents} potential duplicate student name groups`,
      resolutionHint: "Review and merge duplicate records",
    });
  }
  if ((missingContacts ?? 0) > 0) {
    issues.push({
      severity: "info" as const,
      message: `${missingContacts} students missing contact email`,
      resolutionHint: "Update student contact information",
    });
  }

  const qualityScore = Math.max(0, 100 - duplicateStudents * 5 - (missingContacts ?? 0) * 0.5);
  const correctiveActions = [
    duplicateStudents ? "Run duplicate student review" : null,
    (missingContacts ?? 0) > 0 ? "Complete missing contact records" : null,
    "Schedule monthly quality scans",
  ].filter(Boolean) as string[];

  const snapshot = {
    organization_id: organizationId,
    school_id: schoolId ?? null,
    quality_score: qualityScore,
    duplicate_students: duplicateStudents,
    duplicate_families: 0,
    missing_contacts: missingContacts ?? 0,
    broken_relationships: 0,
    incomplete_records: missingContacts ?? 0,
    orphaned_files: 0,
    issues,
    corrective_actions: correctiveActions,
    snapshot_date: new Date().toISOString().split("T")[0],
  };

  await supabase.from("edp_quality_snapshots").upsert(snapshot, {
    onConflict: "organization_id,school_id,snapshot_date",
  });

  return {
    qualityScore,
    duplicateStudents,
    duplicateFamilies: 0,
    missingContacts: missingContacts ?? 0,
    brokenRelationships: 0,
    incompleteRecords: missingContacts ?? 0,
    orphanedFiles: 0,
    issues,
    correctiveActions,
  };
}

export async function getLatestQualitySnapshot(supabase: AuthClient, organizationId: string) {
  const { data } = await supabase
    .from("edp_quality_snapshots")
    .select("*")
    .eq("organization_id", organizationId)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
