import { describe, expect, it } from "vitest";

import {
  buildPlan,
  distribute,
  standardSlots,
  type BuildPlanInput,
} from "@/lib/finance/plan-builder";

/**
 * These cases are not invented. Every one is a real 2026-27 arrangement already
 * in the database, and several of them are the exact schedules that were built
 * by hand and came out wrong.
 *
 * The point of the suite is one assertion repeated in many shapes: what the
 * family is asked to pay adds up to what the family owes. Sixteen documents in
 * the Florida folder fail that test. None of these do.
 */

function slots(firstPayable: string) {
  return standardSlots(firstPayable);
}

describe("distribute", () => {
  it("splits evenly when it divides", () => {
    expect(distribute(850_00 * 10, 10)).toEqual(Array(10).fill(85000));
  });

  it("puts the remainder on the last payment, never the first", () => {
    // 8,500 over 9 is 944.444..., the Cole Heffernan case.
    const shares = distribute(850000, 9);
    expect(shares.slice(0, 8)).toEqual(Array(8).fill(94444));
    expect(shares[8]).toBe(94448);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(850000);
  });

  it("always sums exactly, for any total and any count", () => {
    // The hand-built schedules failed by one to eight cents. This is the
    // property that makes that impossible, checked exhaustively rather than
    // on the handful of cases someone thought to try.
    for (let total = 0; total <= 2000; total += 7) {
      for (let count = 1; count <= 26; count++) {
        const shares = distribute(total, count);
        expect(shares).toHaveLength(count);
        expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
        expect(shares.every((s) => Number.isInteger(s))).toBe(true);
      }
    }
  });

  it("returns nothing when there is nowhere to put the money", () => {
    expect(distribute(50000, 0)).toEqual([]);
  });
});

describe("buildPlan — real arrangements", () => {
  it("Cate Crath: The HS Experience at 850 a month is 8,500 over ten payments", () => {
    const plan = buildPlan({
      lines: [
        {
          itemCode: "hs_experience",
          itemName: "The HS Experience",
          amount: 850,
          frequency: "monthly",
          billedToFamily: true,
        },
      ],
      instalments: slots("2026-08-25"),
    });

    expect(plan.annualTuition).toBe(8500);
    expect(plan.remainingDue).toBe(8500);
    expect(plan.instalmentTotal).toBe(8500);
    // Signing plus August through April.
    expect(plan.instalments.filter((i) => i.amount > 0)).toHaveLength(10);
    expect(plan.instalments.every((i) => i.amount === 0 || i.amount === 850)).toBe(true);
    // The three months before she starts stay on the schedule at zero, exactly
    // as the documents show them.
    expect(plan.instalments.filter((i) => i.amount === 0)).toHaveLength(3);
  });

  it("Cole Heffernan: nine payments of 8,500 close to the cent, unlike his document", () => {
    const plan = buildPlan({
      lines: [
        {
          itemCode: "hs_experience",
          itemName: "The HS Experience",
          amount: 8500,
          frequency: "annual",
          billedToFamily: true,
        },
      ],
      instalments: slots("2026-09-25"),
    });

    expect(plan.remainingDue).toBe(8500);
    expect(plan.instalmentTotal).toBe(8500);

    const paid = plan.instalments.filter((i) => i.amount > 0);
    expect(paid).toHaveLength(9);
    // His actual document lists nine payments of 944.44, which is 8,499.96 —
    // four cents short, and the reason migration 281 had to forgive it.
    expect(paid.slice(0, 8).every((i) => i.amount === 944.44)).toBe(true);
    expect(paid[8]!.amount).toBe(944.48);
  });

  it("Izrael Alexander: 3,965 over twelve does not divide, and still closes", () => {
    const plan = buildPlan({
      lines: [
        { itemCode: "fl_campus", itemName: "FL Campus", amount: 14975, frequency: "annual", billedToFamily: true },
      ],
      scholarships: [{ programName: "Step Up", awardedAmount: 11010 }],
      instalments: slots("2026-06-25"),
    });

    expect(plan.remainingDue).toBe(3965);
    expect(plan.instalmentTotal).toBe(3965);

    // Signing plus June through April is twelve payments, and 3,965 does not
    // divide by twelve. His real schedule charges twelve of 330.42, which is
    // 3,965.04 — the four cents migration 281 had to credit back.
    const paid = plan.instalments.filter((i) => i.amount > 0);
    expect(paid).toHaveLength(12);
    expect(paid.slice(0, 11).every((i) => i.amount === 330.41)).toBe(true);
    expect(paid[11]!.amount).toBe(330.49);
  });

  it("Alexander Pobuda: the bundle discount he never got", () => {
    const plan = buildPlan({
      lines: [
        { itemCode: "hs_experience", itemName: "The HS Experience", amount: 8500, frequency: "annual", billedToFamily: true },
        { itemCode: "math", itemName: "Math class", amount: 4250, frequency: "annual", billedToFamily: true },
      ],
      bundleDiscounts: [
        { name: "HS + a la carte", packageItemCode: "hs_experience", minAdditionalItems: 1, amount: 1000 },
      ],
      scholarships: [{ programName: "Step Up", awardedAmount: 11899 }],
      instalments: slots("2026-09-25"),
    });

    expect(plan.annualTuition).toBe(12750);
    expect(plan.bundleDiscount).toBe(1000);
    expect(plan.bundleDiscountName).toBe("HS + a la carte");
    // 12,750 less the 1,000 bundle is 11,750, and Step Up pays 11,899 — so the
    // award now exceeds the bill. His hand-built schedule missed the discount
    // and charged the family 851 instead.
    expect(plan.remainingDue).toBe(0);
    expect(plan.scholarshipSurplus).toBe(149);
    expect(plan.warnings.some((w) => w.includes("exceed"))).toBe(true);
  });

  it("an employee child owes nothing and the schedule collects nothing", () => {
    const plan = buildPlan({
      lines: [
        { itemCode: "fl_campus", itemName: "FL Campus", amount: 11043, frequency: "annual", billedToFamily: true },
      ],
      scholarships: [{ programName: "Step Up (FES-UA)", awardedAmount: 11043 }],
      instalments: slots("2026-05-25"),
    });

    expect(plan.remainingDue).toBe(0);
    expect(plan.instalmentTotal).toBe(0);
    expect(plan.instalments.every((i) => i.amount === 0)).toBe(true);
  });

  it("Ivy Ash: twelve 1:1 sessions a month at 45, plus a class", () => {
    const plan = buildPlan({
      lines: [
        {
          itemCode: "structured_literacy",
          itemName: "Structured Literacy 1:1",
          amount: null,
          frequency: "per_session",
          oneToOneSessionRate: 45,
          sessionsPerMonth: 12,
          billedToFamily: true,
        },
        { itemCode: "earthology", itemName: "Earthology", amount: 425, frequency: "monthly", billedToFamily: true },
      ],
      instalments: slots("2026-05-25"),
    });

    // 12 x 45 = 540 a month, plus 425 a month, across ten billed months.
    expect(plan.annualTuition).toBe(9650);
    expect(plan.instalmentTotal).toBe(plan.remainingDue);
  });

  it("prorates ten twelfths without pretending the annual figure changed", () => {
    const plan = buildPlan({
      lines: [
        { itemCode: "fl_campus", itemName: "FL Campus", amount: 15000, frequency: "annual", billedToFamily: true },
      ],
      proration: { monthsAttending: 10, monthsInYear: 12 },
      instalments: slots("2026-07-25"),
    });

    expect(plan.annualTuition).toBe(15000);
    expect(plan.proratedTuition).toBe(12500);
    expect(plan.prorationLabel).toBe("10 of 12 months");
    expect(plan.billingBasis).toBe(12500);
  });

  it("leaves the annual figure alone when there is no proration", () => {
    const plan = buildPlan({
      lines: [
        { itemCode: "fl_campus", itemName: "FL Campus", amount: 15000, frequency: "annual", billedToFamily: true },
      ],
      instalments: slots("2026-05-25"),
    });
    // NULL, not 15000. "Not prorated" and "prorated to the same number" are
    // different facts, and the document says different things about them.
    expect(plan.proratedTuition).toBeNull();
    expect(plan.billingBasis).toBe(15000);
  });
});

describe("buildPlan — what it refuses to do", () => {
  it("will not bill an item with no price, and says so", () => {
    const plan = buildPlan({
      lines: [
        { itemCode: "mystery", itemName: "Unpriced class", amount: null, frequency: "monthly", billedToFamily: true },
      ],
      instalments: slots("2026-05-25"),
    });
    expect(plan.annualTuition).toBe(0);
    expect(plan.warnings.some((w) => w.includes("no price set"))).toBe(true);
  });

  it("will not bill 1:1 sessions with no session rate", () => {
    const plan = buildPlan({
      lines: [
        {
          itemCode: "sl",
          itemName: "Structured Literacy 1:1",
          amount: null,
          frequency: "per_session",
          oneToOneSessionRate: null,
          sessionsPerMonth: 8,
          billedToFamily: true,
        },
      ],
      instalments: slots("2026-05-25"),
    });
    expect(plan.annualTuition).toBe(0);
    expect(plan.warnings.some((w) => w.includes("1:1 session rate"))).toBe(true);
  });

  it("does not charge the family for a class another school provides", () => {
    const plan = buildPlan({
      lines: [
        { itemCode: "hs_experience", itemName: "The HS Experience", amount: 8500, frequency: "annual", billedToFamily: true },
        { itemCode: "sl_class", itemName: "Structured Literacy", amount: 850, frequency: "monthly", billedToFamily: false },
      ],
      instalments: slots("2026-05-25"),
    });
    expect(plan.annualTuition).toBe(8500);
    expect(plan.warnings.some((w) => w.includes("owed school to school"))).toBe(true);
  });

  it("never reports a negative balance", () => {
    const plan = buildPlan({
      lines: [
        { itemCode: "x", itemName: "Something", amount: 5000, frequency: "annual", billedToFamily: true },
      ],
      scholarships: [{ programName: "Big award", awardedAmount: 9000 }],
      instalments: slots("2026-05-25"),
    });
    expect(plan.remainingDue).toBe(0);
    expect(plan.scholarshipSurplus).toBe(4000);
  });

  it("refuses outright when money is owed and nothing can collect it", () => {
    // Not a warning. A plan that owes 5,000 and collects 0 is precisely the
    // shape this module exists to make impossible, so it does not come back
    // with a caveat attached — it does not come back.
    const input: BuildPlanInput = {
      lines: [
        { itemCode: "x", itemName: "Something", amount: 5000, frequency: "annual", billedToFamily: true },
      ],
      instalments: [{ label: "Due Upon Signing Contract", dueDate: null, payable: false }],
    };
    expect(() => buildPlan(input)).toThrow(/no payment on the schedule is marked payable/);
  });
});

describe("the invariant", () => {
  it("holds across a wide sweep of prices, awards and start months", () => {
    const starts = ["2026-05-25", "2026-07-25", "2026-09-25", "2027-01-25"];
    for (let price = 0; price <= 20000; price += 337) {
      for (const award of [0, 1000, 7343, 11899, 25000]) {
        for (const start of starts) {
          const plan = buildPlan({
            lines: [
              { itemCode: "x", itemName: "Tuition", amount: price, frequency: "annual", billedToFamily: true },
            ],
            scholarships: award ? [{ programName: "Award", awardedAmount: award }] : [],
            instalments: slots(start),
          });
          // The one thing that must always be true.
          expect(plan.instalmentTotal).toBe(plan.remainingDue);
          expect(plan.remainingDue).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});
