import { createAuthClient } from "@/lib/supabase/server-auth";
import { requireCloudPermission } from "@/lib/cloud-platform/page-guard";
import { getTickets } from "@/lib/cloud-platform/support";
import { getCustomers } from "@/lib/cloud-platform/customers";
import { CloudShell } from "@/components/cloud-platform/CloudNav";
import { CloudTable } from "@/components/cloud-platform/CloudPanels";
import { createTicketAction, resolveTicketAction } from "@/lib/cloud-platform/actions";

export default async function CloudSupportPage() {
  await requireCloudPermission(["cloud.admin", "cloud.support"]);
  const supabase = await createAuthClient();
  const [tickets, customers] = await Promise.all([getTickets(supabase), getCustomers(supabase)]);

  return (
    <CloudShell title="Support Desk" subtitle="Tickets, bugs, feature requests, escalations, and internal notes">
      <form action={createTicketAction} className="space-y-3 rounded-2xl border bg-white p-4">
        <select name="customer_id" className="w-full rounded-lg border px-3 py-2 text-sm">
          {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
        </select>
        <input name="subject" placeholder="Subject" className="w-full rounded-lg border px-3 py-2 text-sm" required />
        <textarea name="description" placeholder="Description" className="w-full rounded-lg border px-3 py-2 text-sm" rows={3} />
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Create ticket</button>
      </form>
      <CloudTable rows={tickets} columns={[
        { key: "ticket_number", label: "#" }, { key: "subject", label: "Subject" },
        { key: "priority", label: "Priority" }, { key: "status", label: "Status" },
      ]} />
      {tickets.filter((t) => t.status !== "resolved").map((t) => (
        <form key={t.id} action={resolveTicketAction} className="inline mr-2">
          <input type="hidden" name="ticket_id" value={t.id} />
          <button type="submit" className="text-sm text-green-600 hover:underline">Resolve {t.ticket_number}</button>
        </form>
      ))}
    </CloudShell>
  );
}
