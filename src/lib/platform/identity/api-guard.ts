import { NextResponse } from "next/server";
import type { createAuthClient } from "@/lib/supabase/server-auth";
import {
  requirePermission,
  unauthorizedResponse,
} from "@/lib/platform/identity/permissions";
import type { PermissionKey } from "@/lib/platform/identity/types";

type AuthClient = Awaited<ReturnType<typeof createAuthClient>>;

export async function guardApiRoute(
  supabase: AuthClient,
  permission?: PermissionKey
): Promise<{ userId: string } | NextResponse> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthorizedResponse();

  if (permission) {
    const gate = await requirePermission(supabase, permission);
    if (!gate.ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return { userId: user.id };
}
