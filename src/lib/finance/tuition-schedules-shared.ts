/**
 * Shapes and wording for the payment-schedules screen.
 *
 * Split from `tuition-schedules.ts` for the same reason the price grid is:
 * that module reaches `createAuthClient`, and a client component importing it
 * even for a type drags server-only code toward the browser bundle.
 *
 * Most of what is here is vocabulary rather than logic, and that is the point.
 * Three distinctions on this screen are easy to blur and expensive to blur:
 *
 *   - A month-to-month arrangement HAS NO YEAR TOTAL. Not zero, not unknown —
 *     there is no such number, because nobody agreed to one. Rendering "$0.00"
 *     or silently multiplying by ten invents a debt.
 *   - "Closes" only means something for a plan with a schedule. For a monthly
 *     plan there is nothing to close, so the answer is not "no", it is "the
 *     question does not apply".
 *   - "Paid through Square" and "we have not established how they pay" are
 *     different facts. Four families here pay outside Square entirely.
 */

export type BillingMode = "scheduled" | "monthly_open";

export interface InstalmentRow {
  readonly id: string;
  readonly sequence: number;
  readonly label: string;
  readonly dueDate: string | null;
  readonly amount: number;
  readonly isPaid: boolean;
  readonly paidAt: string | null;
}

export interface PlanRow {
  readonly planId: string;
  readonly studentId: string;
  readonly student: string;
  readonly schoolName: string;
  readonly schoolYear: string;
  readonly billingMode: BillingMode;
  readonly paymentChannel: string | null;

  /** Set only for monthly_open. The charge for one month, with no end date. */
  readonly monthlyAmount: number | null;

  /** Set only for scheduled. There is no year total for a monthly plan. */
  readonly remainingDue: number | null;
  readonly billingBasis: number | null;
  readonly scheduledTotal: number | null;
  readonly unaccounted: number | null;
  /** True, false, or null where the plan has nothing to close. */
  readonly closes: boolean | null;

  readonly forgivenessAmount: number;
  readonly overpaymentCredit: number;
  readonly paidToDate: number;
  readonly instalmentCount: number;

  readonly sourceDocument: string | null;
  readonly notes: string | null;
  readonly instalments: InstalmentRow[];
}

/** An enrolled student with no plan at all. The most useful row on the page. */
export interface UnplannedStudent {
  readonly studentId: string;
  readonly student: string;
  readonly schoolName: string;
  readonly gradeLevel: string | null;
}

export interface SchoolSchedules {
  readonly schoolName: string;
  readonly plans: PlanRow[];
  readonly unplanned: UnplannedStudent[];
  /** Sum of monthly_amount across monthly plans. Committed recurring revenue. */
  readonly monthlyCommitted: number;
  /** Sum of remaining_due across scheduled plans. Owed across the year. */
  readonly scheduledOwed: number;
  /** Scheduled plans whose arithmetic does not close. Should always be zero. */
  readonly notClosing: number;
  /** Plans whose money arrives outside Square, or by no known route. */
  readonly offSquare: number;
}

export interface SchedulesView {
  readonly schools: SchoolSchedules[];
  readonly totalPlans: number;
  readonly totalUnplanned: number;
  readonly totalNotClosing: number;
}

export function usd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * What to call an arrangement in a sentence.
 *
 * "Monthly" without "no end date" reads as "monthly instalments of a known
 * total", which is the opposite of what monthly_open means.
 */
export function arrangementLabel(mode: BillingMode): string {
  return mode === "scheduled" ? "Schedule" : "Monthly, no end date";
}

/**
 * Where the money arrives.
 *
 * `null` is deliberately NOT rendered as Square. A family whose route has never
 * been established looks identical to one who pays by card unless the screen
 * says so, and that is precisely the family who quietly stops paying.
 */
export function channelLabel(channel: string | null): string {
  switch (channel) {
    case "square_recurring":
      return "Square — recurring";
    case "square_invoice":
      return "Square — invoiced";
    case "classwallet":
      return "ClassWallet";
    case "state_direct":
      return "Paid by the state";
    case "other":
      return "Invoiced directly";
    case null:
      return "Not established";
    default:
      // Show the raw value rather than assert a route we do not recognise.
      return channel;
  }
}

/**
 * Whether a Square-to-JAG reconciliation would wrongly flag this family.
 *
 * These are the families the monthly Square export cannot see. Without this,
 * every reconciliation reports them as unpaid, and an exception list nobody
 * trusts is worse than no list at all.
 */
export function isOffSquare(channel: string | null): boolean {
  return channel !== "square_recurring" && channel !== "square_invoice";
}

/**
 * How to say whether a plan's arithmetic holds.
 *
 * `null` is not a failure. A month-to-month plan has no total and no schedule,
 * so there is nothing that could fail to add up. Rendering that as a red "No"
 * puts twenty permanently-broken rows on the screen and teaches everyone to
 * ignore the column.
 */
export function closesLabel(closes: boolean | null): {
  text: string;
  tone: "ok" | "bad" | "na";
} {
  if (closes === null) return { text: "Nothing to close", tone: "na" };
  if (closes) return { text: "Adds up", tone: "ok" };
  return { text: "DOES NOT ADD UP", tone: "bad" };
}
