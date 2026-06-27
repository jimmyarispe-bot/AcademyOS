import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { passwordResetRequiredResponse, userMustResetPassword } from "@/lib/auth/must-reset-password";
import { getParentLinkedStudentIds } from "@/lib/platform/identity/portal-access";
import { buildIcsCalendar, getFamilyCalendarEvents } from "@/lib/portal/calendar";

export async function GET(request: NextRequest) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (userMustResetPassword(user)) return passwordResetRequiredResponse();

  const params = request.nextUrl.searchParams;
  const from = params.get("from") ?? new Date().toISOString().split("T")[0];
  const to = params.get("to") ?? new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0];

  const studentIds = await getParentLinkedStudentIds(supabase, user.id);
  const events = await getFamilyCalendarEvents(supabase, studentIds, from, to);
  const ics = buildIcsCalendar(events, "AcademyOS Family Calendar");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="academyos-family.ics"',
    },
  });
}
