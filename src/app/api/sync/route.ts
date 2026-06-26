import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/sync";

export const maxDuration = 60; // allow longer for first full sync
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  return header === `Bearer ${secret}`;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runSync();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
