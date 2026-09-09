"use client";

import { ActionButton, useActionFeedback } from "@/components/experience-system/feedback";
import { setLeadAutomation } from "@/lib/admissions/actions";

/**
 * Start — or stop — automated follow-up for one family.
 *
 * This is the human decision the whole automation gate exists to preserve. The
 * public inquiry form opts a family in the moment they ask to hear from us;
 * every family already in JAG waits for someone to press this.
 *
 * It uses ActionButton rather than a bare <button> on purpose: a spinner, a
 * disabled state and aria-busy while the action runs, so nobody is left
 * wondering whether their click registered — which matters most on the one
 * screen where a mis-click emails a real parent.
 */
export function StartAutomationButton({
  leadId,
  isOn,
}: {
  leadId: string;
  isOn: boolean;
}) {
  const action = useActionFeedback({
    verb: isOn ? "custom" : "send",
    labels: isOn
      ? { idle: "Following up", loading: "Stopping…", success: "✓ Stopped" }
      : { idle: "Start follow-up", loading: "Starting…", success: "✓ Started" },
    successToast: isOn
      ? "Automated follow-up stopped for this family."
      : "Automated follow-up started. It resumes from this family's current stage.",
    errorToast: "Could not change follow-up for this family.",
    progressLabel: isOn ? "Stopping follow-up…" : "Starting follow-up…",
  });

  return (
    <ActionButton
      status={action.status}
      variant={isOn ? "secondary" : "primary"}
      size="xs"
      errorMessage={action.errorMessage}
      labels={
        isOn
          ? { idle: "Following up", loading: "Stopping…", success: "✓ Stopped" }
          : { idle: "Start follow-up", loading: "Starting…", success: "✓ Started" }
      }
      onClick={() =>
        void action.run(async () => {
          const result = await setLeadAutomation(leadId, !isOn);
          if (result && "error" in result && result.error) throw new Error(result.error);
          return { success: true };
        })
      }
    />
  );
}
