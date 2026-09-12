/**
 * Turning a stored phone number into something a phone can dial.
 *
 * What is on file is whatever somebody typed: "(407) 555-0123", "407.555.0123",
 * "+1 407 555 0123 ext 12". A `tel:` href has to be stricter than that, and the
 * number shown on screen should stay exactly as the family gave it — the
 * formatting is often how they recognise their own number.
 *
 * So: display the stored text, dial a normalised copy.
 */

/** Digits, plus a leading + if the stored value had one. */
function digitsOnly(value: string): { digits: string; hadPlus: boolean } {
  const trimmed = value.trim();
  const hadPlus = trimmed.startsWith("+");
  return { digits: trimmed.replace(/\D/g, ""), hadPlus };
}

/**
 * The `tel:` target for a stored phone number, or null when there is nothing
 * dialable in it.
 *
 * A bare ten digits is assumed to be North American and given +1. That is the
 * only assumption made here, and it is right for every campus this network has.
 * Eleven digits starting with 1 get the same treatment. Anything else is passed
 * through as digits, because a number this function does not recognise is more
 * useful dialable-as-typed than not dialable at all.
 *
 * An extension is dropped rather than guessed at. `tel:` can carry one after a
 * `;ext=`, but only some diallers honour it, and a number that dials the switch-
 * board is better than one that fails.
 */
export function telHref(value: string | null | undefined): string | null {
  if (!value) return null;
  const { digits, hadPlus } = digitsOnly(value);
  if (digits.length < 7) return null;

  if (hadPlus) return `tel:+${digits}`;
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `tel:+${digits}`;
  return `tel:${digits}`;
}

/**
 * Whether a stored value is worth turning into a `mailto:`.
 *
 * Deliberately loose. This decides whether to render a link, not whether to
 * accept an address — `checkEmailAddress` does the real validation where it
 * matters. Refusing to link something that turns out to be a valid address is
 * the worse mistake here, because it costs somebody a click every day.
 */
export function isLinkableEmail(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (/\s/.test(trimmed)) return false;
  return /^[^@]+@[^@.]+\.[^@]+$/.test(trimmed);
}

export function mailtoHref(value: string | null | undefined): string | null {
  if (!isLinkableEmail(value)) return null;
  return `mailto:${value!.trim()}`;
}
