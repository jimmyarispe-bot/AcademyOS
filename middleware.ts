import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";



export async function middleware(req: NextRequest) {

  const res = NextResponse.next();



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



  const isDashboard = req.nextUrl.pathname.startsWith("/dashboard");
  const isAdminLegacy = req.nextUrl.pathname.startsWith("/admin");

  const isProtectedApp = isDashboard
    || req.nextUrl.pathname.startsWith("/cloud")
    || req.nextUrl.pathname.startsWith("/operations")
    || isAdminLegacy;

  if (isProtectedApp && !user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
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
  ],

};


