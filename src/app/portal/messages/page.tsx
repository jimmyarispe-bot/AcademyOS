import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getParentLinkedStudentIds } from "@/lib/platform/identity/portal-access";
import { getPortalConversations, getPortalMessages } from "@/lib/portal/messages";
import { PortalMessagesPanel } from "@/components/portal/PortalMessagesPanel";

export default async function PortalMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/portal/messages");

  const { conversation: selectedId } = await searchParams;
  const supabase = await createAuthClient();
  const studentIds = await getParentLinkedStudentIds(supabase, sessionUser.id);
  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name")
    .in("id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);

  const conversations = await getPortalConversations(supabase, sessionUser.id);
  const messages = selectedId ? await getPortalMessages(supabase, selectedId) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Secure Messaging</h1>
        <p className="mt-1 text-slate-600">Message teachers, therapists, finance, and school leaders. All messages are logged to your student&apos;s timeline.</p>
      </div>
      <PortalMessagesPanel
        conversations={conversations}
        messages={messages}
        selectedConversationId={selectedId}
        students={students ?? []}
        currentUserId={sessionUser.id}
      />
    </div>
  );
}
