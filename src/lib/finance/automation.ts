import type { createAuthClient } from "@/lib/supabase/server-auth";
import { enqueuePlatformJob } from "@/lib/platform/automation/queue";
import { createMissionControlItem } from "@/lib/platform/automation/mission-control";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function syncFinanceAlertsToMissionControl(supabase: AuthClient) {
  const today = new Date().toISOString().split("T")[0];

  const { data: overdue } = await supabase
    .from("invoices")
    .select("id, invoice_number, due_date, total_amount, amount_paid, family_billing_accounts(school_id, family_id)")
    .in("invoice_status", ["sent", "partial", "overdue"])
    .lt("due_date", today)
    .limit(25);

  for (const inv of overdue ?? []) {
    const acct = Array.isArray(inv.family_billing_accounts) ? inv.family_billing_accounts[0] : inv.family_billing_accounts;
    const schoolId = (acct as { school_id?: string })?.school_id;
    const familyId = (acct as { family_id?: string })?.family_id;
    if (!schoolId) continue;

    await createMissionControlItem(supabase, {
      schoolId,
      module: "finance",
      itemType: "finance_alert",
      title: `Overdue invoice ${inv.invoice_number}`,
      body: `Balance due: $${(Number(inv.total_amount) - Number(inv.amount_paid)).toFixed(2)}`,
      href: familyId ? `/dashboard/finance/families/${familyId}` : "/dashboard/finance",
      entityType: "invoices",
      entityId: inv.id,
    });

    await supabase.from("invoices").update({ invoice_status: "overdue" }).eq("id", inv.id);
  }
}

export async function enqueueBillingReminder(
  supabase: AuthClient,
  input: { schoolId: string; familyId: string; invoiceId: string; dueDate: string }
) {
  await enqueuePlatformJob(supabase, {
    schoolId: input.schoolId,
    module: "finance",
    jobType: "billing_reminder",
    entityType: "invoices",
    entityId: input.invoiceId,
    scheduledFor: `${input.dueDate}T09:00:00.000Z`,
    payload: { family_id: input.familyId },
  });
}

export async function enqueueScholarshipRenewalReminder(
  supabase: AuthClient,
  input: { schoolId: string; scholarshipApplicationId: string; renewalDate: string }
) {
  await enqueuePlatformJob(supabase, {
    schoolId: input.schoolId,
    module: "finance",
    jobType: "scholarship_renewal_reminder",
    entityType: "scholarship_applications",
    entityId: input.scholarshipApplicationId,
    scheduledFor: `${input.renewalDate}T08:00:00.000Z`,
  });
}

export async function processFinanceQueueJobs(supabase: AuthClient) {
  const now = new Date().toISOString();
  const { data: jobs } = await supabase
    .from("platform_queue_jobs")
    .select("*")
    .eq("module", "finance")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .limit(25);

  for (const job of jobs ?? []) {
    const payload = (job.payload ?? {}) as Record<string, unknown>;
    let title = "Finance follow-up";
    if (job.job_type === "billing_reminder") title = "Billing reminder due";
    if (job.job_type === "scholarship_renewal_reminder") title = "Scholarship renewal due";

    await createMissionControlItem(supabase, {
      schoolId: job.school_id,
      module: "finance",
      itemType: "finance_alert",
      title,
      body: String(payload.message ?? ""),
      href: payload.family_id ? `/dashboard/finance/families/${payload.family_id}` : "/dashboard/finance",
      entityType: job.entity_type,
      entityId: job.entity_id,
    });

    await supabase.from("platform_queue_jobs").update({ status: "completed", completed_at: now }).eq("id", job.id);
  }
}
