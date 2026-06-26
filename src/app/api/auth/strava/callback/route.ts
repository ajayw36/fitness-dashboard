import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/strava";

// Strava redirects here with ?code=... after the user approves access.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/settings?strava=${error}`, req.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/settings?strava=missing_code", req.url));
  }

  try {
    await exchangeCode(code);
    return NextResponse.redirect(new URL("/settings?strava=connected", req.url));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "exchange_failed";
    return NextResponse.redirect(
      new URL(`/settings?strava=error&detail=${encodeURIComponent(msg)}`, req.url),
    );
  }
}
