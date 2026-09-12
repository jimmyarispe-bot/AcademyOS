import { createAnonServerClient } from "@/lib/supabase/server";

/**
 * The student-facing side of the questionnaire.
 *
 * Uses the anonymous client deliberately — a fourteen-year-old has no account
 * and must not need one. Everything goes through the SECURITY DEFINER functions
 * in migration 340, which fail closed and hand back the student's first name and
 * the school's name and nothing else.
 */

/**
 * The generated `database.ts` does not know these functions exist, so the typed
 * client rejects the name. Casting the rpc call is the narrowest way through —
 * the alternative is regenerating types for the whole schema as a side effect of
 * this feature.
 */
type RpcCaller = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export type StudentQuestionnaireView =
  | {
      readonly state: "open";
      readonly school: string;
      readonly studentFirstName: string;
      readonly expiresAt: string;
    }
  | { readonly state: "completed" }
  | { readonly state: "invalid" }
  | { readonly state: "expired" }
  | { readonly state: "closed" };

/** Postgres error text is for us, not for a sixteen-year-old. */
function classify(error: unknown): StudentQuestionnaireView {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("student_questionnaire_link_expired")) return { state: "expired" };
  if (message.includes("student_questionnaire_link_closed")) return { state: "closed" };
  return { state: "invalid" };
}

export async function resolveStudentQuestionnaire(
  token: string
): Promise<StudentQuestionnaireView> {
  try {
    const supabase = createAnonServerClient() as unknown as RpcCaller;
    const { data, error } = await supabase.rpc("resolve_student_questionnaire", {
      p_token: token,
    });
    if (error) return classify(new Error(error.message));

    const payload = data as Record<string, unknown> | null;
    if (!payload) return { state: "invalid" };
    if (payload.status === "completed") return { state: "completed" };

    return {
      state: "open",
      school: String(payload.school ?? ""),
      studentFirstName: String(payload.student_first_name ?? ""),
      expiresAt: String(payload.expires_at ?? ""),
    };
  } catch (e) {
    return classify(e);
  }
}
