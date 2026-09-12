import {
  ProfileCard,
  ProfileItem,
} from "@/components/platform/profile-workspace/ProfilePrimitives";
import type { ProfileSectionViewProps } from "@/lib/platform/profile/sections/types";
import { STUDENT_QUESTIONS } from "@/lib/admissions/student-questionnaire/questions";
import { missing } from "./shared";
import { EmailLink } from "@/components/platform/contact/ContactLink";

type QuestionnaireRow = {
  id: string;
  student_email: string | null;
  status: string | null;
  answers: Record<string, unknown> | null;
  sent_at: string | null;
  opened_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
};

function when(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

/**
 * What the student said, in their own words.
 *
 * Shown at full length and never truncated. These five answers are the reason
 * the high school asks for them at all, and a reader skimming a three-line
 * preview is reading the opposite of what was intended.
 *
 * When nothing has come back yet the card still appears, because "sent, not
 * answered" is the state somebody needs to see in order to chase it. A silent
 * absence looks like a campus that does not ask.
 */
export function StudentQuestionnaireSection(props: ProfileSectionViewProps) {
  const data = props.data as { questionnaires: QuestionnaireRow[] } | null;
  if (!data || !data.questionnaires.length) return missing("Student Questionnaire");

  return (
    <div className="space-y-6">
      {data.questionnaires.map((row) => {
        const answers = (row.answers ?? {}) as Record<string, unknown>;
        const answered = STUDENT_QUESTIONS.filter((q) =>
          String(answers[q.key] ?? "").trim()
        );

        return (
          <ProfileCard
            key={row.id}
            title={
              row.status === "completed"
                ? "Student Questionnaire — answered"
                : row.status === "cancelled"
                  ? "Student Questionnaire — superseded"
                  : "Student Questionnaire — sent, not yet answered"
            }
          >
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <ProfileItem label="Sent to" value={<EmailLink email={row.student_email} />} />
              <ProfileItem label="Sent" value={when(row.sent_at)} />
              <ProfileItem label="Opened" value={when(row.opened_at)} />
              <ProfileItem
                label={row.status === "completed" ? "Answered" : "Link expires"}
                value={when(row.status === "completed" ? row.completed_at : row.expires_at)}
              />
            </div>

            {answered.length ? (
              <dl className="mt-5 space-y-5">
                {answered.map((question) => (
                  <div key={question.key}>
                    <dt className="text-sm font-medium text-slate-900">{question.label}</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {String(answers[question.key])}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                {row.status === "cancelled"
                  ? "A newer link was sent, so this one no longer works."
                  : "Nothing has come back yet. The student has their own link and can answer at any time before it expires."}
              </p>
            )}
          </ProfileCard>
        );
      })}
    </div>
  );
}
