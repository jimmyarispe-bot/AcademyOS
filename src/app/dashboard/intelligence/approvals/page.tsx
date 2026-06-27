import { createAuthClient } from "@/lib/supabase/server-auth";
import { requirePagePermission } from "@/lib/platform/identity/page-guard";
import { getPrimaryOrganizationId } from "@/lib/intelligence-platform/context";
import { getPendingApprovals } from "@/lib/intelligence-platform/approvals-audit";
import { AipShell } from "@/components/intelligence-platform/AipNav";
import { HistoryTable } from "@/components/intelligence-platform/AipPanels";
import { reviewApprovalAction } from "@/lib/intelligence-platform/actions";

export default async function ApprovalsPage() {
  await requirePagePermission(["ai.manage", "ai.admin"]);

  const supabase = await createAuthClient();
  const orgId = await getPrimaryOrganizationId(supabase);
  const approvals = orgId ? await getPendingApprovals(supabase, orgId) : [];

  return (
    <AipShell title="Approval Workflows" subtitle="Auto approved, human review, executive review, founder approval, publish, reject, rollback">
      <section>
        <h2 className="mb-3 font-semibold">Pending approvals</h2>
        <HistoryTable
          rows={approvals}
          columns={[
            { key: "entity_type", label: "Entity" },
            { key: "approval_type", label: "Type" },
            { key: "status", label: "Status" },
            { key: "requested_at", label: "Requested" },
          ]}
        />
        {approvals.map((a) => (
          <div key={a.id} className="mt-2 flex gap-2">
            <form action={reviewApprovalAction}>
              <input type="hidden" name="approval_id" value={a.id} />
              <input type="hidden" name="status" value="approved" />
              <button type="submit" className="text-sm text-green-600 hover:underline">Approve</button>
            </form>
            <form action={reviewApprovalAction}>
              <input type="hidden" name="approval_id" value={a.id} />
              <input type="hidden" name="status" value="rejected" />
              <button type="submit" className="text-sm text-red-600 hover:underline">Reject</button>
            </form>
          </div>
        ))}
        {!approvals.length && <p className="text-sm text-slate-500">No pending approvals.</p>}
      </section>
    </AipShell>
  );
}
