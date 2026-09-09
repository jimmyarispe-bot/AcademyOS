/**
 * The one place that writes `admissions_leads.automation_started_at`.
 *
 * WHAT THE COLUMN MEANS. NULL: automated parent follow-up has never been
 * switched on for this family, and nothing will contact them. Set: someone
 * decided to start, and the reminder engine picks them up from their CURRENT
 * stage rather than the beginning of the process.
 *
 * WHY IT EXISTS. `processParentReminders` used to read every row in
 * `admissions_leads` with no filter — 289 families, including the 113 parked at
 * `information_sent` since 2 February 2026. The only thing preventing an
 * automated chase was an instruction not to run the job. On 10 September 2026
 * the public inquiry URLs went onto the school websites, which removed that
 * protection, so the protection became a column.
 *
 * WHY IT IS ITS OWN MODULE. The column was added by hand-run migration 320 and
 * is therefore absent from the generated `database.ts`, which stops at the
 * committed migrations. Writing it needs a narrow structural type. Doing that
 * inline at each call site would scatter three casts and no explanation; here it
 * is asserted once, and the columns below are the contract.
 */

/** Any Supabase client — cookie-bound or service role. Both write this column. */
type LooseLeadUpdater = {
  from: (table: string) => {
    update: (row: Record<string, unknown>) => {
      eq: (column: string, value: string) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

export type AutomationGateResult = { error?: string };

/**
 * Switch automated follow-up on (`when` = an ISO timestamp) or off (`null`).
 *
 * The returned error is always checked by callers. supabase-js resolves an RLS
 * refusal rather than throwing, so an unchecked write here would leave a family
 * silently un-started — the quietest possible failure, and precisely the one
 * this gate exists to make loud.
 */
export async function setAutomationStartedAt(
  client: unknown,
  leadId: string,
  when: string | null
): Promise<AutomationGateResult> {
  const { error } = await (client as LooseLeadUpdater)
    .from("admissions_leads")
    .update({ automation_started_at: when })
    .eq("id", leadId);

  return error ? { error: error.message } : {};
}
