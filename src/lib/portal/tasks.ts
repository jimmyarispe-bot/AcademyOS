import type { createAuthClient } from "@/lib/supabase/server-auth";
import { getParentDeadlines, mapObligationsToPortalTasks } from "@/lib/compliance/deadlines";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function getPortalTasks(supabase: AuthClient, userId: string, studentIds: string[]) {
  if (!studentIds.length) return [];

  const buckets = await getParentDeadlines(supabase, userId, studentIds);
  const obligations = [
    ...buckets.overdue,
    ...buckets.today,
    ...buckets.thisWeek,
    ...buckets.next30Days,
  ];

  return mapObligationsToPortalTasks(obligations).sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}
