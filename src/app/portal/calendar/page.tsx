import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { getParentLinkedStudentIds } from "@/lib/platform/identity/portal-access";
import { getFamilyCalendarEvents } from "@/lib/portal/calendar";

export default async function PortalCalendarPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/portal/calendar");

  const supabase = await createAuthClient();
  const studentIds = await getParentLinkedStudentIds(supabase, sessionUser.id);
  const from = new Date().toISOString().split("T")[0];
  const toDate = new Date(Date.now() + 60 * 86400000);
  const to = toDate.toISOString().split("T")[0];
  const events = await getFamilyCalendarEvents(supabase, studentIds, from, to);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Family Calendar</h1>
          <p className="mt-1 text-slate-600">Classes, therapy, conferences, school events, and payment due dates.</p>
        </div>
        <a
          href={`/api/portal/calendar.ics?from=${from}&to=${to}`}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Export ICS
        </a>
      </div>

      <ul className="space-y-2">
        {events.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{e.title}</p>
              <p className="text-slate-500 capitalize">{e.category.replace(/_/g, " ")}{e.studentName ? ` · ${e.studentName}` : ""}</p>
            </div>
            <time className="text-slate-600">{new Date(e.start).toLocaleString()}</time>
          </li>
        ))}
        {!events.length && <li className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500">No upcoming events in the next 60 days.</li>}
      </ul>
    </div>
  );
}
