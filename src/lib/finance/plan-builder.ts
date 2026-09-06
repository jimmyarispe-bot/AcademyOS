/**
 * Building a student's tuition plan.
 *
 * Every one of the 77 plans in the database arrived by hand: someone read a
 * price list, did the arithmetic in their head or in Word, and typed a schedule
 * into a document. That produced, in a single folder:
 *
 *   Hailey Rosser        2,000.00 wrong
 *   Abigail McHoney      3,325.00 wrong, against the family
 *   Aaliyah Clinkscales  1,000.00 wrong
 *   Penny Shropshire       750.00 wrong
 *   Alexander Pobuda     1,000.00 discount never applied
 *   sixteen FL schedules out by one to eight cents each
 *
 * The cents are trivial and the thousands are not, but they have one cause:
 * nothing computed the answer. This module computes the answer.
 *
 * MONEY IS HELD IN CENTS, as integers, everywhere inside here. A tuition figure
 * that has ever been a float is a tuition figure you cannot reconcile — 0.1 +
 * 0.2 is not 0.3, and a year of instalments compounds that into a real
 * discrepancy. Only `toDollars` at the boundary converts back.
 *
 * THE INSTALMENTS ALWAYS SUM TO WHAT IS OWED. Exactly. This is the whole point:
 * twelve equal payments of a figure that does not divide by twelve will not add
 * up, and every hand-built schedule in the folder proves it. The remainder goes
 * on the LAST payment, so the family's regular monthly amount is the round
 * number they expect and the year closes to the cent.
 */

export type BillingFrequency = "monthly" | "annual" | "semester" | "quarterly" | "weekly" | "per_session";

/** One thing the family is buying. */
export interface PlanLineInput {
  readonly itemCode: string;
  readonly itemName: string;
  /** The catalog price for ONE billing period of `frequency`. Null = not priced. */
  readonly amount: number | null;
  readonly frequency: BillingFrequency;
  /** Set only when this line is bought as 1:1 sessions rather than as a class. */
  readonly oneToOneSessionRate?: number | null;
  /** Sessions per month, when the line is 1:1. */
  readonly sessionsPerMonth?: number;
  /** False when the providing school is not the attending school: owed school to school. */
  readonly billedToFamily: boolean;
}

export interface BundleDiscountInput {
  readonly name: string;
  /** The item whose presence makes this a bundle (e.g. The HS Experience). */
  readonly packageItemCode: string;
  readonly minAdditionalItems: number;
  readonly amount: number;
}

export interface ScholarshipInput {
  readonly programName: string;
  readonly awardedAmount: number;
}

/** One row of the payment schedule. Zero rows are kept: see below. */
export interface InstalmentSlotInput {
  readonly label: string;
  /** Null for "Due Upon Signing Contract". */
  readonly dueDate: string | null;
  /**
   * False for the months before the family starts paying. Every schedule in the
   * folder lists those months at 0.00, and dropping them makes the document look
   * like months were skipped.
   */
  readonly payable: boolean;
}

export interface BuildPlanInput {
  readonly lines: PlanLineInput[];
  readonly bundleDiscounts?: BundleDiscountInput[];
  /**
   * Percent off, applied to one child in a family. Passed in rather than
   * derived: there is no table of sibling rules yet, and a discount the system
   * invents is a discount nobody can defend to a parent.
   */
  readonly siblingDiscountPercent?: number;
  readonly scholarships?: ScholarshipInput[];
  /**
   * Months attended over months in the year, when a student starts late.
   * Ten-over-twelve is the FL convention. Absent means the full year.
   */
  readonly proration?: { readonly monthsAttending: number; readonly monthsInYear: number };
  readonly instalments: InstalmentSlotInput[];
}

export interface BuiltInstalment {
  readonly sequence: number;
  readonly label: string;
  readonly dueDate: string | null;
  readonly amount: number;
}

export interface BuiltPlan {
  /** The full-year price of everything bought, before anything is taken off. */
  readonly annualTuition: number;
  /** The prorated figure, or null when the whole year applies. Null is not zero. */
  readonly proratedTuition: number | null;
  readonly prorationLabel: string | null;
  /** The figure actually billed from — prorated where there is one. */
  readonly billingBasis: number;

  readonly bundleDiscount: number;
  readonly bundleDiscountName: string | null;
  readonly siblingDiscount: number;
  readonly scholarshipTotal: number;

  /** What the family owes. Never negative. */
  readonly remainingDue: number;
  /** Award beyond what is owed. Recorded, not silently dropped. */
  readonly scholarshipSurplus: number;

  readonly instalments: BuiltInstalment[];
  /** Sum of the instalments. Equal to remainingDue, always. */
  readonly instalmentTotal: number;

  /** Things a person should read before sending this to a family. */
  readonly warnings: string[];
}

// ---------------------------------------------------------------------------
// Cents
// ---------------------------------------------------------------------------

function toCents(dollars: number): number {
  // Math.round, not truncation: 14.975 * 100 is 1497.4999999999998 in binary
  // floating point, and truncating loses a cent on a figure that is exact.
  return Math.round(dollars * 100);
}

function toDollars(cents: number): number {
  return cents / 100;
}

/**
 * How many billing periods of `frequency` are in one school year.
 *
 * `per_session` is deliberately absent: a session rate says nothing about how
 * many sessions a family buys, so multiplying it by anything here would invent
 * a number. Session lines are handled explicitly by their session count.
 */
const PERIODS_PER_YEAR: Record<Exclude<BillingFrequency, "per_session">, number> = {
  monthly: 10,
  annual: 1,
  semester: 2,
  quarterly: 4,
  weekly: 36,
};

/**
 * Ten months, not twelve. The Academy bills a monthly rate across a ten-month
 * school year — $850/month is The HS Experience's $8,500, and $1,500/month is
 * Virtual's $15,000. Twelve would overstate every monthly line by a fifth.
 */
export const MONTHS_BILLED_PER_YEAR = PERIODS_PER_YEAR.monthly;

// ---------------------------------------------------------------------------
// The build
// ---------------------------------------------------------------------------

export function buildPlan(input: BuildPlanInput): BuiltPlan {
  const warnings: string[] = [];

  // 1. What the year costs.
  let annualCents = 0;
  for (const line of input.lines) {
    if (!line.billedToFamily) {
      // The attending school is not the provider. The family is not billed; one
      // school owes the other. It belongs on the plan as context, not as price.
      warnings.push(
        `${line.itemName} is provided by another school — owed school to school, not billed to the family.`
      );
      continue;
    }

    if (line.sessionsPerMonth !== undefined) {
      const rate = line.oneToOneSessionRate;
      if (rate === null || rate === undefined) {
        // Not priced 1:1 is not the same as free. Refuse to bill it.
        warnings.push(
          `${line.itemName} has no 1:1 session rate, so it cannot be billed. Set a rate or remove the line.`
        );
        continue;
      }
      annualCents += toCents(rate) * line.sessionsPerMonth * MONTHS_BILLED_PER_YEAR;
      continue;
    }

    if (line.amount === null) {
      // A blank price means "may not bill yet". It is not zero.
      warnings.push(`${line.itemName} has no price set, so it cannot be billed yet.`);
      continue;
    }

    if (line.frequency === "per_session") {
      warnings.push(
        `${line.itemName} is priced per session but no session count was given, so it was left out.`
      );
      continue;
    }

    annualCents += toCents(line.amount) * PERIODS_PER_YEAR[line.frequency];
  }

  // 2. Proration. NULL when the whole year applies — not equal to the annual
  //    figure, because "no proration" and "prorated to the same number" are
  //    different facts and a reader should be able to tell them apart.
  let proratedCents: number | null = null;
  let prorationLabel: string | null = null;
  if (input.proration) {
    const { monthsAttending, monthsInYear } = input.proration;
    if (monthsInYear > 0 && monthsAttending > 0 && monthsAttending < monthsInYear) {
      proratedCents = Math.round((annualCents * monthsAttending) / monthsInYear);
      prorationLabel = `${monthsAttending} of ${monthsInYear} months`;
    }
  }

  const basisCents = proratedCents ?? annualCents;

  // 3. The bundle discount. Applies when the package item is present AND enough
  //    other billed items sit alongside it.
  let bundleCents = 0;
  let bundleName: string | null = null;
  const billedLines = input.lines.filter((l) => l.billedToFamily);
  for (const d of input.bundleDiscounts ?? []) {
    const hasPackage = billedLines.some((l) => l.itemCode === d.packageItemCode);
    const additional = billedLines.filter((l) => l.itemCode !== d.packageItemCode).length;
    if (hasPackage && additional >= d.minAdditionalItems) {
      bundleCents = toCents(d.amount);
      bundleName = d.name;
      break;
    }
  }

  // 4. Sibling discount, on the basis after the bundle.
  const siblingCents = input.siblingDiscountPercent
    ? Math.round(((basisCents - bundleCents) * input.siblingDiscountPercent) / 100)
    : 0;

  // 5. Scholarships.
  const scholarshipCents = (input.scholarships ?? []).reduce(
    (sum, s) => sum + toCents(s.awardedAmount),
    0
  );

  const owedBeforeScholarship = basisCents - bundleCents - siblingCents;
  let remainingCents = owedBeforeScholarship - scholarshipCents;
  let surplusCents = 0;
  if (remainingCents < 0) {
    // An award larger than the bill. Not negative tuition — a surplus, which the
    // state may claw back or apply elsewhere. Recorded rather than swallowed,
    // because a family owing "minus $400" is a sentence with no meaning.
    surplusCents = -remainingCents;
    remainingCents = 0;
    warnings.push(
      `Scholarships exceed what is owed by ${formatUsd(toDollars(surplusCents))}. The family owes nothing; check whether the surplus is returnable.`
    );
  }

  // 6. The schedule.
  const payableCount = input.instalments.filter((s) => s.payable).length;

  // A balance with nowhere to collect it is not a warning, it is an
  // impossibility. Returning a plan here would mean returning one whose
  // instalments do not sum to what is owed — the exact defect this module
  // exists to make unrepresentable. It is a refusal, and the message names the
  // cause rather than reporting the symptom further down.
  if (remainingCents > 0 && payableCount === 0) {
    throw new Error(
      `The family owes ${formatUsd(toDollars(remainingCents))} but no payment on the schedule is marked payable. Mark at least one, or the schedule collects nothing.`
    );
  }

  const shares = distribute(remainingCents, payableCount);
  let payableIndex = 0;
  const instalments: BuiltInstalment[] = input.instalments.map((slot, i) => ({
    sequence: i + 1,
    label: slot.label,
    dueDate: slot.dueDate,
    amount: slot.payable ? toDollars(shares[payableIndex++] ?? 0) : 0,
  }));

  const instalmentTotalCents = instalments.reduce((sum, i) => sum + toCents(i.amount), 0);

  // The invariant this module exists to hold. If it ever fails, the plan must
  // not be saved — a schedule that does not sum to the balance is exactly the
  // defect in sixteen of the FL documents.
  if (instalmentTotalCents !== remainingCents) {
    throw new Error(
      `Instalments total ${formatUsd(toDollars(instalmentTotalCents))} against a balance of ${formatUsd(toDollars(remainingCents))}. Refusing to build a schedule that does not add up.`
    );
  }

  return {
    annualTuition: toDollars(annualCents),
    proratedTuition: proratedCents === null ? null : toDollars(proratedCents),
    prorationLabel,
    billingBasis: toDollars(basisCents),
    bundleDiscount: toDollars(bundleCents),
    bundleDiscountName: bundleName,
    siblingDiscount: toDollars(siblingCents),
    scholarshipTotal: toDollars(scholarshipCents),
    remainingDue: toDollars(remainingCents),
    scholarshipSurplus: toDollars(surplusCents),
    instalments,
    instalmentTotal: toDollars(instalmentTotalCents),
    warnings,
  };
}

/**
 * Split `totalCents` into `count` whole-cent shares that sum EXACTLY to it.
 *
 * Every share is the rounded-down equal amount; the remainder — always fewer
 * cents than there are shares — goes onto the LAST one. So a family sees the
 * same round figure every month and a few extra cents at the end, rather than
 * twelve identical payments that quietly miss the total.
 *
 *   3965.00 over 12  ->  eleven of 330.41, one of 330.49
 *
 * The alternative, spreading the remainder over the first few payments, makes
 * two different monthly amounts on one schedule. Families read that as an error.
 */
export function distribute(totalCents: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalCents / count);
  const shares = new Array<number>(count).fill(base);
  shares[count - 1] = totalCents - base * (count - 1);
  return shares;
}

export function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * The thirteen rows every Academy schedule uses: a signing payment, then May
 * through April.
 *
 * Hard-coded rather than generated from a date range. The one thing on a tuition
 * schedule that must never be guessed is a due date, and these are the dates the
 * documents families already hold actually carry.
 */
export function standardSlots(firstPayableMonth: string): InstalmentSlotInput[] {
  const months: Array<[string, string]> = [
    ["Due May 25, 2026", "2026-05-25"],
    ["Due June 25, 2026", "2026-06-25"],
    ["Due July 25, 2026", "2026-07-25"],
    ["Due August 25, 2026", "2026-08-25"],
    ["Due September 25, 2026", "2026-09-25"],
    ["Due October 25, 2026", "2026-10-25"],
    ["Due November 25, 2026", "2026-11-25"],
    ["Due December 25, 2026", "2026-12-25"],
    ["Due January 25, 2027", "2027-01-25"],
    ["Due February 25, 2027", "2027-02-25"],
    ["Due March 25, 2027", "2027-03-25"],
    ["Due April 25, 2027", "2027-04-25"],
  ];
  const startIndex = months.findIndex(([, iso]) => iso >= firstPayableMonth);
  const from = startIndex === -1 ? months.length : startIndex;

  return [
    { label: "Due Upon Signing Contract", dueDate: null, payable: true },
    ...months.map(([label, iso], i) => ({ label, dueDate: iso, payable: i >= from })),
  ];
}
