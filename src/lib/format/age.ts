/**
 * Age from a date of birth.
 *
 * WHY THIS IS A FUNCTION AND NOT A COLUMN. Age is not a fact about a person; it
 * is a fact about a person AND today. Stored, it is wrong within a year and the
 * row gives no way to tell whether it ever was right. The HS admissions
 * application asks for an age from a dropdown, which is why a student who
 * applied in March is fourteen in the file forever.
 *
 * Birthdate is the fact. Age is derived, everywhere, from this one place.
 */

/**
 * Whole years between `dateOfBirth` and `asOf` (default: today).
 *
 * Returns null for anything unparseable, for a birthdate in the future, and for
 * an age beyond 150 — all three are data errors rather than ages, and a form
 * showing "Age 1,024" because a parent typed the year wrong is less useful than
 * one showing nothing.
 *
 * Date-only strings ("2011-04-27") are read as local time, not UTC. `new Date()`
 * treats a bare ISO date as midnight UTC, which lands on the previous day west
 * of Greenwich and makes the age tick over a day early for every family in the
 * United States.
 */
export function ageFromDateOfBirth(
  dateOfBirth: string | Date | null | undefined,
  asOf: Date = new Date()
): number | null {
  if (!dateOfBirth) return null;

  let born: Date;
  if (dateOfBirth instanceof Date) {
    born = dateOfBirth;
  } else {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth.trim());
    born = dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
      : new Date(dateOfBirth);
  }

  if (Number.isNaN(born.getTime())) return null;
  if (born.getTime() > asOf.getTime()) return null;

  let age = asOf.getFullYear() - born.getFullYear();

  // Birthday not yet reached this year.
  const monthDiff = asOf.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < born.getDate())) {
    age -= 1;
  }

  if (age < 0 || age > 150) return null;
  return age;
}

/** "14 years old", or null when the birthdate cannot produce an age. */
export function ageLabelFromDateOfBirth(
  dateOfBirth: string | Date | null | undefined,
  asOf: Date = new Date()
): string | null {
  const age = ageFromDateOfBirth(dateOfBirth, asOf);
  if (age === null) return null;
  return age === 1 ? "1 year old" : `${age} years old`;
}
