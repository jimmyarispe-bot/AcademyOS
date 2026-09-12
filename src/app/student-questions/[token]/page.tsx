import { resolveStudentQuestionnaire } from "@/lib/admissions/student-questionnaire/public";
import { StudentQuestionnaireForm } from "@/components/admissions/StudentQuestionnaireForm";
import { STUDENT_QUESTIONNAIRE_INTRO } from "@/lib/admissions/student-questionnaire/questions";

export const metadata = {
  title: "Five questions for you",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The page a student lands on from their email. No account, no login.
 *
 * Every failure reads as a sentence a teenager can act on.
 * "student_questionnaire_token_invalid" is for the logs.
 */
export default async function StudentQuestionnairePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await resolveStudentQuestionnaire(token);

  const shell = (title: string, body: string) => (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-3 text-slate-600">{body}</p>
    </main>
  );

  if (view.state === "completed") {
    return shell(
      "Already received",
      "Thank you — your answers are already with the admissions team. There is nothing else to do."
    );
  }
  if (view.state === "expired") {
    return shell(
      "This link has expired",
      "Links stay live for 45 days. Ask whoever is helping with your application and the school will send a new one."
    );
  }
  if (view.state === "closed") {
    return shell(
      "This link is closed",
      "Please contact the school if you still want to send your answers."
    );
  }
  if (view.state === "invalid") {
    return shell(
      "We could not open this link",
      "Please check the address in the email, or contact the school."
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm text-slate-500">{view.school}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
        {view.studentFirstName ? `${view.studentFirstName}, this part is yours` : "This part is yours"}
      </h1>
      <p className="mt-4 text-slate-600">{STUDENT_QUESTIONNAIRE_INTRO}</p>
      <StudentQuestionnaireForm token={token} />
      <p className="mt-10 text-xs text-slate-400">
        This link is just for you and is not indexed or shared.
      </p>
    </main>
  );
}
