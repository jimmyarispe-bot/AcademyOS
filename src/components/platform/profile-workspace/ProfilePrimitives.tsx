import type { ReactNode } from "react";

export function ProfileCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/**
 * A labelled value.
 *
 * `capitalize` applies only to plain strings, which is what it was written for
 * — a grade or a status stored lower case. It was being applied to everything,
 * which is why an email address rendered as "Jimmy.Arispe@Gmail.Com": CSS
 * title-casing an address that is not title-cased anywhere else, and that a
 * reader may well try to retype.
 *
 * A ReactNode value — a link, a badge, anything already formatted — is rendered
 * as given. The caller has decided how it should look.
 */
export function ProfileItem({ label, value }: { label: string; value: ReactNode }) {
  const isPlainText = typeof value === "string" || typeof value === "number";
  return (
    <div>
      <dt className="text-xs uppercase text-slate-400">{label}</dt>
      <dd className={`text-sm text-slate-900 ${isPlainText ? "capitalize" : ""}`}>{value}</dd>
    </div>
  );
}

export function ProfileEmpty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-400">{children}</p>;
}

export function ProfileBadge({
  label,
  tone = "slate",
}: {
  label: string;
  tone?: "slate" | "amber" | "rose" | "brand";
}) {
  const colors = {
    slate: "bg-slate-100 text-slate-700",
    amber: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-800",
    brand: "bg-brand-50 text-brand-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[tone]}`}>
      {label}
    </span>
  );
}

export function ProfileJsonList({ label, items }: { label: string; items: unknown }) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return null;
  return (
    <div className="mt-3">
      <p className="text-xs uppercase text-slate-400">{label}</p>
      <ul className="mt-1 list-inside list-disc text-sm text-slate-700">
        {list.map((item, i) => (
          <li key={i}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
        ))}
      </ul>
    </div>
  );
}
