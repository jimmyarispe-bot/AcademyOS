/** Academy Way instructional scheduling rules */

export type AcademySubject = "reading" | "writing" | "math" | "structured_literacy" | "other";

export const ACADEMY_VIRTUAL_SUBJECTS: AcademySubject[] = [
  "reading",
  "writing",
  "math",
  "structured_literacy",
];

export const DEFAULT_ACADEMY_WAY_CONFIG = {
  virtualStartOnHour: true,
  virtualEndAtMinute: 50,
  use12HourDisplay: true,
  minReadingSize: 4,
  minWritingSize: 4,
  minMathSize: 4,
  minStructuredLiteracySize: 2,
  tutoringMaxSize: 1,
  allowHsInVirtual: true,
};

export function minClassSizeForSubject(
  subject: AcademySubject | null | undefined,
  config = DEFAULT_ACADEMY_WAY_CONFIG
): number {
  switch (subject) {
    case "structured_literacy":
      return config.minStructuredLiteracySize;
    case "reading":
      return config.minReadingSize;
    case "writing":
      return config.minWritingSize;
    case "math":
      return config.minMathSize;
    default:
      return 1;
  }
}

export function maxClassSizeForDelivery(deliveryMode: string): number {
  if (deliveryMode === "tutoring" || deliveryMode === "therapy") return 1;
  return 30;
}

/** Virtual classes start on the hour and end at :50 — returns end time for a given start */
export function academyVirtualEndTime(start: Date, endMinute = 50): Date {
  const end = new Date(start);
  end.setMinutes(endMinute, 0, 0);
  if (end <= start) end.setHours(end.getHours() + 1);
  return end;
}

/** Format time in 12-hour display (no military time) */
export function formatAcademyTime(date: Date | string, timezone = "America/New_York"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  });
}

export function validateSectionAgainstAcademyWay(input: {
  academySubject?: AcademySubject | null;
  deliveryMode?: string;
  minCapacity?: number;
  maxCapacity?: number;
  enrolledCount?: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const min = minClassSizeForSubject(input.academySubject);
  const max = maxClassSizeForDelivery(input.deliveryMode ?? "virtual");

  if ((input.minCapacity ?? min) < min) {
    errors.push(`Minimum class size for ${input.academySubject ?? "subject"} is ${min}`);
  }
  if ((input.maxCapacity ?? max) > max && input.deliveryMode === "tutoring") {
    errors.push("Tutoring sessions must be 1:1");
  }
  if (input.enrolledCount !== undefined && input.enrolledCount > (input.maxCapacity ?? max)) {
    errors.push("Enrollment exceeds section capacity");
  }
  return { valid: errors.length === 0, errors };
}

export function structuredLiteracyLabel(level?: number | null, step?: number | null): string {
  if (!level) return "—";
  return step ? `Level ${level}, Step ${step}` : `Level ${level}`;
}

export function academyLevelLabel(level?: number | null): string {
  if (!level) return "—";
  return `Level ${level}`;
}
