import type { createAuthClient } from "@/lib/supabase/server-auth";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";
import { computeClassProfitability, computeProgramProfitability } from "@/lib/financial-intelligence/profitability";
import { computeBreakEvenAnalysis } from "@/lib/financial-intelligence/break-even";
import { computeSchoolFinancials } from "@/lib/financial-intelligence/school-financials";
import { getFamilyAnalytics } from "@/lib/financial-intelligence/family-analytics";
import { getFinanceExecutiveDashboard } from "@/lib/finance/dashboards";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function syncFinancialIntelligence(supabase: AuthClient) {
  const { data: schools } = await supabase.from("schools").select("id").limit(50);

  for (const school of schools ?? []) {
    await computeClassProfitability(supabase, school.id, "monthly");
    await computeProgramProfitability(supabase, school.id);
    await computeBreakEvenAnalysis(supabase, school.id);
    await computeSchoolFinancials(supabase, school.id);
    await getFamilyAnalytics(supabase, school.id, 100);
    await generateFinancialAlerts(supabase, school.id);
  }

  await syncFiAlertsToMissionControl(supabase);
}

async function generateFinancialAlerts(supabase: AuthClient, schoolId: string) {
  const [classes, programs, finance] = await Promise.all([
    computeClassProfitability(supabase, schoolId, "monthly"),
    computeProgramProfitability(supabase, schoolId),
    getFinanceExecutiveDashboard(supabase, schoolId),
  ]);

  for (const cls of classes.filter((c) => c.currentEnrollment < c.breakEvenEnrollment)) {
    await upsertFiAlert(supabase, {
      schoolId,
      alertType: "class_below_breakeven",
      severity: cls.marginPct < 0 ? "critical" : "high",
      title: `Class below break-even: ${cls.sectionCode}`,
      body: `Enrollment ${cls.currentEnrollment} vs break-even ${cls.breakEvenEnrollment}. Net margin ${cls.netMargin.toFixed(0)}.`,
      entityType: "class",
      entityId: cls.courseSectionId,
    });
  }

  for (const prog of programs.filter((p) => p.netMargin < 0)) {
    await upsertFiAlert(supabase, {
      schoolId,
      alertType: "program_loss",
      severity: "high",
      title: `Program losing money: ${prog.program}`,
      body: `Net margin ${prog.netMargin.toFixed(0)} on revenue ${prog.revenue.toFixed(0)}.`,
      entityType: "program",
      entityKey: prog.program,
    });
  }

  if (finance.outstanding > finance.totalCollected * 0.35) {
    await upsertFiAlert(supabase, {
      schoolId,
      alertType: "collection_issue",
      severity: "high",
      title: "Collection risk elevated",
      body: `Outstanding AR ${finance.outstanding.toFixed(0)} exceeds 35% of collected revenue.`,
    });
  }

  if (finance.collectionRate < 75) {
    await upsertFiAlert(supabase, {
      schoolId,
      alertType: "low_cash",
      severity: "normal",
      title: "Low collection rate",
      body: `Collection rate is ${finance.collectionRate}% — review billing follow-up.`,
    });
  }
}

async function upsertFiAlert(
  supabase: AuthClient,
  input: {
    schoolId: string;
    alertType: string;
    severity: string;
    title: string;
    body?: string;
    entityType?: string;
    entityId?: string;
    entityKey?: string;
  }
) {
  let query = supabase
    .from("fi_financial_alerts")
    .select("id")
    .eq("school_id", input.schoolId)
    .eq("alert_type", input.alertType)
    .eq("is_resolved", false);

  if (input.entityId) query = query.eq("entity_id", input.entityId);
  else if (input.entityKey) query = query.eq("title", input.title);

  const { data: existing } = await query.maybeSingle();
  if (existing) return;

  await supabase.from("fi_financial_alerts").insert({
    school_id: input.schoolId,
    alert_type: input.alertType,
    severity: input.severity,
    title: input.title,
    body: input.body ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
  });
}

export async function syncFiAlertsToMissionControl(supabase: AuthClient) {
  const { data: alerts } = await supabase
    .from("fi_financial_alerts")
    .select("*")
    .eq("is_resolved", false)
    .is("mission_control_item_id", null)
    .limit(50);

  for (const alert of alerts ?? []) {
    const severity =
      alert.severity === "critical" ? "critical" : alert.severity === "high" ? "high" : "normal";

    await createMissionControlItem(supabase, {
      schoolId: alert.school_id,
      module: "executive",
      itemType: "executive_alert",
      title: alert.title,
      body: alert.body ?? undefined,
      href: "/dashboard/finance/intelligence",
      entityType: "fi_financial_alerts",
      entityId: alert.id,
      assignedRole: "SCHOOL_LEADER",
      severity,
    });

    const { data: mcItem } = await supabase
      .from("platform_mission_control_items")
      .select("id")
      .eq("entity_type", "fi_financial_alerts")
      .eq("entity_id", alert.id)
      .eq("is_resolved", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (mcItem?.id) {
      await supabase
        .from("fi_financial_alerts")
        .update({ mission_control_item_id: mcItem.id })
        .eq("id", alert.id);
    }
  }
}
