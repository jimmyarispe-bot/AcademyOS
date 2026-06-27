import type { SuccessIndicator } from "@/lib/ssis/score";

const STYLES: Record<SuccessIndicator, { ring: string; bg: string; text: string; label: string }> = {
  green: { ring: "ring-emerald-200", bg: "bg-emerald-50", text: "text-emerald-800", label: "On Track" },
  yellow: { ring: "ring-amber-200", bg: "bg-amber-50", text: "text-amber-800", label: "Needs Attention" },
  red: { ring: "ring-rose-200", bg: "bg-rose-50", text: "text-rose-800", label: "At Risk" },
};

interface SuccessScoreBadgeProps {
  score: number;
  indicator: SuccessIndicator;
  size?: "sm" | "lg";
}

export function SuccessScoreBadge({ score, indicator, size = "sm" }: SuccessScoreBadgeProps) {
  const s = STYLES[indicator];
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full ring-1 ${s.ring} ${s.bg} ${s.text} ${
        size === "lg" ? "px-4 py-2 text-sm" : "px-3 py-1 text-xs"
      }`}
    >
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          indicator === "green" ? "bg-emerald-500" : indicator === "yellow" ? "bg-amber-500" : "bg-rose-500"
        }`}
      />
      <span className="font-semibold">{Math.round(score)}</span>
      <span className="opacity-80">{s.label}</span>
    </div>
  );
}

interface SuccessScoreBreakdownProps {
  components: Record<string, number>;
}

const COMPONENT_LABELS: Record<string, string> = {
  attendance: "Attendance",
  academic_growth: "Academic Growth",
  behavior: "Behavior",
  intervention_progress: "Interventions",
  parent_engagement: "Parent Engagement",
  funding_status: "Funding",
  missing_documents: "Documents",
  compliance: "Compliance",
};

export function SuccessScoreBreakdown({ components }: SuccessScoreBreakdownProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {Object.entries(components).map(([key, value]) => (
        <div key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-600">{COMPONENT_LABELS[key] ?? key}</span>
          <span className="font-medium text-slate-900">{value}</span>
        </div>
      ))}
    </div>
  );
}
