"use server";

import { createAnonServerClient } from "@/lib/supabase/server";
import {
  STUDENT_QUESTION_KEYS,
  type StudentQuestionKey,
} from "@/lib/admissions/student-questionnaire/questions";

type RpcCaller = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

/**
 * A student submitting their answers. No session, by design.
 *
 * The database function decides what is acceptable: five fixed keys, each
 * capped, anything else ignored. Nothing here is trusted to get that right,
 * because this runs for anyone holding the link.
 */
export async function submitStudentQuestionnaire(input: {
  token: string;
  answers: Partial<Record<StudentQuestionKey, string>>;
}): Promise<{ ok: true; answered: number } | { ok: false; error: string }> {
  const answers: Record<string, string> = {};
  for (const key of STUDENT_QUESTION_KEYS) {
    const value = (input.answers[key] ?? "").trim();
    if (value) answers[key] = value;
  }

  if (!Object.keys(answers).length) {
    return { ok: false, error: "Please answer at least one question before sending." };
  }

  const supabase = createAnonServerClient() as unknown as RpcCaller;
  const { data, error } = await supabase.rpc("submit_student_questionnaire", {
    p_token: input.token,
    p_answers: answers,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("student_questionnaire_link_expired")) {
      return { ok: false, error: "This link has expired. Please ask the school for a new one." };
    }
    if (message.includes("student_questionnaire_link_closed")) {
      return { ok: false, error: "These answers have already been sent in. Thank you." };
    }
    if (message.includes("student_questionnaire_token_invalid")) {
      return { ok: false, error: "This link is not valid. Please check the email again." };
    }
    if (message.includes("student_questionnaire_answers_empty")) {
      return { ok: false, error: "Please answer at least one question before sending." };
    }
    return { ok: false, error: "Something went wrong saving that. Please try again." };
  }

  const answered = Number((data as Record<string, unknown> | null)?.answered ?? 0);
  return { ok: true, answered };
}
