import { NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/strava";

// Kick off the Strava OAuth consent flow.
export async function GET() {
  try {
    return NextResponse.redirect(authorizeUrl());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Strava not configured" },
      { status: 500 },
    );
  }
}
