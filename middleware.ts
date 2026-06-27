import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  isPasswordResetExemptPath,
  isPublicApiPath,
  PASSWORD_RESET_PATH,
  passwordResetRequiredResponse,
  userMustResetPassword,
} from "@/lib/auth/must-reset-password";

function isProtectedPage(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/cloud") ||
    pathname.startsWith("/operations") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/apply/portal")
  );
}

function isProtectedApi(pathname: string): boolean {
  return pathname.startsWith("/api/") && !isPublicApiPath(pathname);
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedPage = isProtectedPage(pathname);
  const protectedApi = isProtectedApi(pathname);

  if ((protectedPage || protectedApi) && !user) {
    if (protectedApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && userMustResetPassword(user) && !isPasswordResetExemptPath(pathname)) {
    if (protectedApi || protectedPage) {
      if (protectedApi) {
        return passwordResetRequiredResponse();
      }
      const resetUrl = new URL(PASSWORD_RESET_PATH, req.url);
      resetUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(resetUrl);
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/cloud",
    "/cloud/:path*",
    "/operations",
    "/operations/:path*",
    "/admin",
    "/admin/:path*",
    "/portal",
    "/portal/:path*",
    "/apply/portal",
    "/apply/portal/:path*",
    "/api/:path*",
  ],
};
