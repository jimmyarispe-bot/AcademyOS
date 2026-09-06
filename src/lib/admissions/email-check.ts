/**
 * Catching an email address that is well-formed and wrong.
 *
 * The interest form already validates addresses. It asks one question —
 * `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` — which is "does this look like an email?",
 * and it is structurally incapable of catching the two that actually reached
 * production:
 *
 *   turpincasey@yahoo.con     bounced. Every message, since August.
 *   amiysha06@gmial.com       DELIVERED. To a stranger.
 *
 * Both pass a shape check perfectly. They are not malformed; they are addressed
 * to the wrong place. No amount of tightening that regex helps.
 *
 * The second is the worse one and the reason this module exists. `gmial.com` is
 * a real registered domain owned by typo-squatters, so mail to it does not
 * bounce — a family's name, their child's name and what they told a school
 * about that child were delivered to someone else, and nothing failed, so
 * nobody found out.
 *
 * SUGGEST, NEVER BLOCK.
 *
 * This module returns a suggestion. It does not reject. A family on a
 * self-hosted or unusual domain must be able to submit, and refusing a real
 * address is worse than accepting a typo: a typo can be corrected later by
 * anyone who notices, whereas a family who is told their email is invalid
 * simply leaves and is never heard from again.
 *
 * Pure and dependency-free, so the same function runs in the browser as the
 * parent types and again on the server at submit — one answer, not two that
 * can drift.
 */

export type EmailCheck =
  | { readonly kind: "ok" }
  /** Structurally not an address. The only case worth blocking on. */
  | { readonly kind: "invalid"; readonly reason: string }
  /** Well-formed, but the domain is one keystroke from a common one. */
  | { readonly kind: "suggest"; readonly suggestion: string; readonly reason: string };

/**
 * Domains common enough that a near-miss is far more likely to be a typo than a
 * real address.
 *
 * Deliberately short. Every entry here is a domain we are willing to say
 * "did you mean" about, and a list padded with rarities starts second-guessing
 * addresses that are perfectly correct — which is how people learn to click
 * past the warning.
 */
const COMMON_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
  "comcast.net",
  "live.com",
  "msn.com",
  "me.com",
  "mac.com",
  "att.net",
  "verizon.net",
  "bellsouth.net",
  "sbcglobal.net",
  "cox.net",
  "charter.net",
  "protonmail.com",
  "proton.me",
  "ymail.com",
  "yahoo.ca",
  "outlook.co.uk",
  "googlemail.com",
  // Real domains that sit one keystroke from a common one. Listed so they
  // match exactly and never become a suggestion: mail.com is a live provider,
  // and "did you mean gmail.com?" against a correct address is the failure
  // that teaches people to ignore the hint.
  "mail.com",
  "email.com",
  "inbox.com",
  "gmx.com",
  "yandex.com",
  "zoho.com",
  "fastmail.com",
  "hey.com",
] as const;

/**
 * Top-level domains that are almost always a slip for `.com`.
 *
 * `.co` and `.net` are NOT here. Both are real, both are used by real families,
 * and a check that cries wolf on a valid address is a check people disable.
 */
const TLD_TYPOS: Record<string, string> = {
  con: "com",
  cmo: "com",
  cim: "com",
  ocm: "com",
  comm: "com",
  xom: "com",
  vom: "com",
  clm: "com",
  "co,": "com",
  nte: "net",
  ent: "net",
  ogr: "org",
  rog: "org",
};

/**
 * Edit distance, counting a TRANSPOSITION as one edit rather than two.
 *
 * This is Damerau-Levenshtein, and the transposition part is the whole reason.
 * Swapping two adjacent letters is the most common typing mistake there is —
 * `gmial` for `gmail`, `hotmial` for `hotmail` — and plain Levenshtein scores
 * those as two edits, the same as a completely different word. A checker
 * without it misses the exact typo it most needs to catch.
 *
 * Capped: we only ever care whether the answer is 1, 2, or more than that.
 */
function editDistance(a: string, b: string, cap: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;

  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, i) => i)];

  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    const prev = rows[i - 1]!;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);

      // Adjacent transposition.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, rows[i - 2]![j - 2]! + 1);
      }

      curr.push(v);
      if (v < rowMin) rowMin = v;
    }
    // Nothing in this row is within the cap, so nothing below it can be either.
    if (rowMin > cap) return cap + 1;
    rows.push(curr);
  }
  return rows[a.length]![b.length]!;
}

/**
 * How many edits are forgivable, judged on the NAME rather than the whole
 * domain.
 *
 * `me.com` and `he.com` differ by one character — the same distance as `gmail`
 * and `gmial` — but one pair is a typo and the other is two different
 * companies. What separates them is proportion: one edit in a two-letter name
 * changes half of it, while one edit in `gmail` changes a fifth.
 *
 * So the threshold scales with the name. Four characters before a single edit
 * is forgivable at all, seven before two are. Below that, no suggestion is
 * made — an unrecognised short domain is far more likely to be somebody's real
 * address than a mistake.
 */
function allowedEdits(candidateLabel: string): number {
  if (candidateLabel.length >= 7) return 2;
  if (candidateLabel.length >= 4) return 1;
  return 0;
}

/** The part of a domain before its top-level suffix. */
function domainLabel(domain: string): string {
  const dot = domain.indexOf(".");
  return dot === -1 ? domain : domain.slice(0, dot);
}

export function checkEmailAddress(raw: string): EmailCheck {
  // Whitespace at either end is never part of an address, and it is how
  // Amyosha Sharkull's record ended up failing a check that its visible text
  // passes. Trimmed before anything else looks at it.
  const value = raw.trim();

  if (value === "") return { kind: "invalid", reason: "Enter an email address." };

  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1) {
    return { kind: "invalid", reason: "An email address needs a name, an @, and a domain." };
  }

  const local = value.slice(0, at);
  const domain = value.slice(at + 1).toLowerCase();

  if (value.slice(0, at).includes("@")) {
    return { kind: "invalid", reason: "An email address can only contain one @." };
  }
  if (/\s/.test(value)) {
    return { kind: "invalid", reason: "An email address cannot contain a space." };
  }
  if (!domain.includes(".")) {
    return { kind: "invalid", reason: "The part after the @ needs a dot, like gmail.com." };
  }
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) {
    return { kind: "invalid", reason: "That domain does not look right." };
  }

  const tld = domain.slice(domain.lastIndexOf(".") + 1);

  // A wrong top-level domain first, and separately from the domain name: the
  // family who typed `yahoo.con` got the hard part right.
  const fixedTld = TLD_TYPOS[tld];
  if (fixedTld) {
    const corrected = `${local}@${domain.slice(0, domain.lastIndexOf(".") + 1)}${fixedTld}`;
    return {
      kind: "suggest",
      suggestion: corrected,
      reason: `.${tld} is not a real domain ending.`,
    };
  }

  if (!/^[a-z]{2,}$/.test(tld)) {
    return { kind: "invalid", reason: "That domain does not look right." };
  }

  if ((COMMON_DOMAINS as readonly string[]).includes(domain)) {
    return { kind: "ok" };
  }

  // Nearest common domain, if it is near enough to be worth mentioning.
  let best: { domain: string; distance: number } | null = null;
  for (const candidate of COMMON_DOMAINS) {
    const cap = allowedEdits(domainLabel(candidate));
    if (cap === 0) continue;
    const distance = editDistance(domain, candidate, cap);
    if (distance <= cap && (best === null || distance < best.distance)) {
      best = { domain: candidate, distance };
    }
  }

  if (best) {
    return {
      kind: "suggest",
      suggestion: `${local}@${best.domain}`,
      reason: `${domain} is very close to ${best.domain}.`,
    };
  }

  // An unrecognised domain is not a problem. Most of the world's email is not
  // at one of twenty-three addresses, and saying otherwise would be wrong far
  // more often than it was right.
  return { kind: "ok" };
}

/** Convenience for callers that only need to know whether to warn. */
export function emailNeedsAttention(raw: string): boolean {
  return checkEmailAddress(raw).kind !== "ok";
}
