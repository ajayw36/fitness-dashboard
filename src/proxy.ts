import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authToken } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  // Auth disabled when no password is configured (e.g. local dev).
  if (!password) return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  const expected = await authToken(password);
  if (cookie && cookie === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

// The settings page and the Strava connect/callback routes require the
// password (so a visitor can't connect their own Strava). The dashboard
// remains publicly viewable.
export const config = {
  matcher: ["/settings", "/settings/:path*", "/api/auth/:path*"],
};
