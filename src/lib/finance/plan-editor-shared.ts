/**
 * Shapes for the plan builder screen.
 *
 * Client-safe: the builder is a client component and the loader reaches
 * `createAuthClient`, which reaches `next/headers`. Same split as the price
 * grid and the schedules screen, for the same reason.
 */

import type { BillingFrequency } from "@/lib/finance/plan-builder";

/** One thing this school sells, priced for this school. */
export interface CatalogChoice {
  readonly catalogItemId: string;
  readonly itemCode: string;
  readonly itemName: string;
  readonly itemKind: string;
  readonly description: string | null;
  readonly amount: number | null;
  readonly frequency: BillingFrequency;
  readonly offeredOneToOne: boolean;
  readonly oneToOneSessionRate: number | null;
  /** False when another school provides it: owed school to school, not billed. */
  readonly billedToFamily: boolean;
  readonly providerSchoolName: string;
}

export interface AwardChoice {
  readonly id: string;
  readonly programName: string;
  readonly awardedAmount: number;
  readonly awardYear: string;
  readonly status: string;
}

export interface BundleChoice {
  readonly id: string;
  readonly name: string;
  readonly packageItemCode: string;
  readonly minAdditionalItems: number;
  readonly amount: number;
}

/** What an existing active plan looks like, for editing rather than replacing blind. */
export interface ExistingPlan {
  readonly planId: string;
  readonly billingMode: "scheduled" | "monthly_open";
  readonly monthlyAmount: number | null;
  readonly remainingDue: number | null;
  readonly paymentChannel: string | null;
  readonly sourceDocument: string | null;
  readonly notes: string | null;
  readonly instalmentCount: number;
}

export interface PlanEditorContext {
  readonly studentId: string;
  readonly studentName: string;
  readonly schoolId: string;
  readonly schoolName: string;
  readonly gradeLevel: string | null;
  readonly schoolYearId: string;
  readonly schoolYearName: string;
  readonly catalog: CatalogChoice[];
  readonly bundles: BundleChoice[];
  readonly awards: AwardChoice[];
  readonly existingPlan: ExistingPlan | null;
  /**
   * Other children in the same family who already hold a plan. Shown because
   * the sibling discount applies to ONE child, and the person building this
   * plan needs to know whether it has already been given to someone else.
   */
  readonly siblingsWithPlans: { readonly name: string; readonly hasSiblingDiscount: boolean }[];
}

export const PAYMENT_CHANNELS = [
  { value: "", label: "Not established yet" },
  { value: "square_recurring", label: "Square — recurring series" },
  { value: "square_invoice", label: "Square — invoiced" },
  { value: "classwallet", label: "ClassWallet" },
  { value: "state_direct", label: "Paid by the state" },
  { value: "other", label: "Invoiced directly" },
] as const;

/**
 * The month a family starts paying.
 *
 * Offered as a list rather than a date picker because these are the only dates
 * the schedules use, and a free date field invites the 29th of a month that a
 * later schedule prints as the 25th.
 */
export const FIRST_PAYABLE_MONTHS = [
  { value: "2026-05-25", label: "May 2026" },
  { value: "2026-06-25", label: "June 2026" },
  { value: "2026-07-25", label: "July 2026" },
  { value: "2026-08-25", label: "August 2026" },
  { value: "2026-09-25", label: "September 2026" },
  { value: "2026-10-25", label: "October 2026" },
  { value: "2026-11-25", label: "November 2026" },
  { value: "2026-12-25", label: "December 2026" },
  { value: "2027-01-25", label: "January 2027" },
  { value: "2027-02-25", label: "February 2027" },
  { value: "2027-03-25", label: "March 2027" },
  { value: "2027-04-25", label: "April 2027" },
] as const;
