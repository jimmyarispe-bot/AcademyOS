export const GRADES = [
  { value: "kindergarten", label: "Kindergarten" },
  { value: "1st_grade", label: "1st Grade" },
  { value: "2nd_grade", label: "2nd Grade" },
  { value: "3rd_grade", label: "3rd Grade" },
  { value: "4th_grade", label: "4th Grade" },
  { value: "5th_grade", label: "5th Grade" },
  { value: "6th_grade", label: "6th Grade" },
  { value: "7th_grade", label: "7th Grade" },
  { value: "8th_grade", label: "8th Grade" },
  { value: "9th_grade", label: "9th Grade" },
  { value: "10th_grade", label: "10th Grade" },
  { value: "11th_grade", label: "11th Grade" },
  { value: "12th_grade", label: "12th Grade" },
] as const;

export type GradeValue = (typeof GRADES)[number]["value"];

const GRADE_BY_VALUE = new Map(GRADES.map((g) => [g.value, g.label]));
const GRADE_BY_LABEL = new Map(
  GRADES.map((g) => [g.label.toLowerCase(), g.label])
);

/** Display label for a stored grade value or legacy free-text entry. */
export function gradeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const normalized = value.trim();
  if (GRADE_BY_VALUE.has(normalized as GradeValue)) {
    return GRADE_BY_VALUE.get(normalized as GradeValue)!;
  }
  const byLabel = GRADE_BY_LABEL.get(normalized.toLowerCase());
  if (byLabel) return byLabel;
  return normalized;
}
