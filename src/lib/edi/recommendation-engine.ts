import type { createAuthClient } from "@/lib/supabase/server-auth";
import { generateClassDecisions } from "@/lib/edi/class-decisions";
import { generateProgramDecisions } from "@/lib/edi/program-decisions";
import { generateTeacherDecisions } from "@/lib/edi/teacher-decisions";
import { generateSchedulingDecisions } from "@/lib/edi/scheduling-optimization";
import { generateFinancialDecisions } from "@/lib/edi/financial-decisions";
import { generateEnrollmentDecisions } from "@/lib/edi/enrollment-decisions";
import { generateStudentSuccessDecisions } from "@/lib/edi/student-success-decisions";
import { persistRecommendations, getRecommendations, mapRowToDecisionCard } from "@/lib/edi/decision-engine";
import type { DecisionCard } from "@/lib/edi/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function generateAllRecommendations(
  supabase: AuthClient,
  schoolId: string
): Promise<DecisionCard[]> {
  const [
    classCards,
    programCards,
    teacherCards,
    schedulingCards,
    financialCards,
    enrollmentCards,
    successCards,
  ] = await Promise.all([
    generateClassDecisions(supabase, schoolId),
    generateProgramDecisions(supabase, schoolId),
    generateTeacherDecisions(supabase, schoolId),
    generateSchedulingDecisions(supabase, schoolId),
    generateFinancialDecisions(supabase, schoolId),
    generateEnrollmentDecisions(supabase, schoolId),
    generateStudentSuccessDecisions(supabase, schoolId),
  ]);

  const all = [
    ...classCards,
    ...programCards,
    ...teacherCards,
    ...schedulingCards,
    ...financialCards,
    ...enrollmentCards,
    ...successCards,
  ].sort((a, b) => b.recommendationScore - a.recommendationScore);

  await persistRecommendations(supabase, all);
  return all;
}

export async function getTopRecommendations(
  supabase: AuthClient,
  schoolId: string,
  limit = 25
): Promise<DecisionCard[]> {
  const rows = await getRecommendations(supabase, schoolId, { limit });
  return rows.map(mapRowToDecisionCard);
}

export async function getRecommendationsByDomain(
  supabase: AuthClient,
  schoolId: string,
  domain: string
): Promise<DecisionCard[]> {
  const rows = await getRecommendations(supabase, schoolId, { domain, limit: 50 });
  return rows.map(mapRowToDecisionCard);
}
