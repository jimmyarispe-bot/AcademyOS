/** Structured Literacy next-step recommendations (Academy Way) */

export function recommendNextStructuredLiteracyStep(
  level: number,
  step: number,
  mastered: boolean
): { level: number; step: number; recommendation: string } {
  if (!mastered) {
    return {
      level,
      step,
      recommendation: `Continue Level ${level}, Step ${step} until mastery is demonstrated`,
    };
  }

  if (step < 10) {
    return {
      level,
      step: step + 1,
      recommendation: `Mastery recorded — advance to Level ${level}, Step ${step + 1}`,
    };
  }

  if (level < 5) {
    return {
      level: level + 1,
      step: 1,
      recommendation: `Level ${level} complete — begin Level ${level + 1}, Step 1`,
    };
  }

  return {
    level: 5,
    step: 10,
    recommendation: "Structured Literacy program complete — transition to reading/writing maintenance",
  };
}

export function computeGrowth(current: number, previous?: number | null): string {
  if (previous == null) return "Baseline recorded";
  const delta = current - previous;
  if (delta > 0) return `+${delta} level(s)`;
  if (delta < 0) return `${delta} level(s)`;
  return "No level change";
}

export function domainLevelRange(domain: string): { min: number; max: number } {
  if (domain === "structured_literacy") return { min: 1, max: 5 };
  if (["reading", "writing", "math"].includes(domain)) return { min: 1, max: 3 };
  return { min: 1, max: 5 };
}
