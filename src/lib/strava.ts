// Strava API client. Docs: https://developers.strava.com/docs/
// OAuth2: access tokens expire every 6h; we persist the refresh token in the DB
// (OAuthToken row) and refresh on demand. Distances are meters, times seconds.

import { prisma } from "@/lib/db";

const API = "https://www.strava.com/api/v3";
const OAUTH = "https://www.strava.com/oauth";
const PROVIDER = "strava";

export interface StravaSummaryActivity {
  id: number;
  name: string;
  type: string; // legacy
  sport_type: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  total_elevation_gain: number;
  start_date: string; // ISO UTC
  start_date_local: string;
  map?: StravaMap;
}

export interface StravaMap {
  id: string;
  polyline?: string; // full precision (detailed activity)
  summary_polyline?: string; // low precision (summary)
}

export interface StravaBestEffort {
  id: number;
  name: string; // e.g. "5k", "1k", "400m"
  elapsed_time: number;
  moving_time: number;
  distance: number;
  start_index: number;
  end_index: number;
  pr_rank: number | null; // 1 = all-time PR
  achievements?: unknown[];
}

export interface StravaSplit {
  distance: number;
  elapsed_time: number;
  elevation_difference: number;
  moving_time: number;
  split: number;
  average_speed: number;
  pace_zone?: number;
}

export interface StravaDetailedActivity extends StravaSummaryActivity {
  calories?: number;
  best_efforts?: StravaBestEffort[];
  splits_metric?: StravaSplit[];
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  athlete?: { id: number };
}

function clientCreds() {
  const id = process.env.STRAVA_CLIENT_ID;
  const secret = process.env.STRAVA_CLIENT_SECRET;
  if (!id || !secret) throw new Error("STRAVA_CLIENT_ID/SECRET not set");
  return { id, secret };
}

export function authorizeUrl(state = ""): string {
  const { id } = clientCreds();
  const redirect = process.env.STRAVA_REDIRECT_URI;
  if (!redirect) throw new Error("STRAVA_REDIRECT_URI not set");
  const u = new URL(`${OAUTH}/authorize`);
  u.searchParams.set("client_id", id);
  u.searchParams.set("redirect_uri", redirect);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("approval_prompt", "auto");
  u.searchParams.set("scope", "read,activity:read_all");
  if (state) u.searchParams.set("state", state);
  return u.toString();
}

/** Exchange an authorization code for tokens and persist them. */
export async function exchangeCode(code: string): Promise<void> {
  const { id, secret } = clientCreds();
  const res = await fetch(`${OAUTH}/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: id,
      client_secret: secret,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Strava token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as TokenResponse;
  await persistTokens(data);
}

async function persistTokens(data: TokenResponse): Promise<void> {
  const expiresAt = new Date(data.expires_at * 1000);
  await prisma.oAuthToken.upsert({
    where: { provider: PROVIDER },
    create: {
      provider: PROVIDER,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      athleteId: data.athlete?.id ? String(data.athlete.id) : null,
    },
    update: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      ...(data.athlete?.id ? { athleteId: String(data.athlete.id) } : {}),
    },
  });
}

/** Return a valid access token, refreshing if it expires within 5 minutes. */
export async function getAccessToken(): Promise<string> {
  const token = await prisma.oAuthToken.findUnique({ where: { provider: PROVIDER } });
  if (!token) {
    throw new Error("Strava not connected. Visit /api/auth/strava to connect.");
  }
  const skewMs = 5 * 60 * 1000;
  if (token.expiresAt.getTime() - skewMs > Date.now()) {
    return token.accessToken;
  }
  const { id, secret } = clientCreds();
  const res = await fetch(`${OAUTH}/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: id,
      client_secret: secret,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    }),
  });
  if (!res.ok) {
    throw new Error(`Strava token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as TokenResponse;
  await persistTokens(data);
  return data.access_token;
}

async function stravaGet<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const accessToken = await getAccessToken();
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (res.status === 429) {
    throw new Error("Strava rate limit hit (429). Try again later.");
  }
  if (!res.ok) {
    throw new Error(`Strava ${path} -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/**
 * List activities after a given epoch-seconds timestamp (0 = all), newest pages
 * fetched until exhausted. Strava returns oldest-first within the `after` window.
 */
export async function listActivities(
  afterEpochSeconds = 0,
  perPage = 100,
): Promise<StravaSummaryActivity[]> {
  const out: StravaSummaryActivity[] = [];
  let page = 1;
  for (;;) {
    const batch = await stravaGet<StravaSummaryActivity[]>("/athlete/activities", {
      after: afterEpochSeconds,
      per_page: perPage,
      page,
    });
    out.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return out;
}

/** Fetch the detailed activity (includes best_efforts, splits_metric, calories). */
export async function getActivityDetail(id: string | number): Promise<StravaDetailedActivity> {
  return stravaGet<StravaDetailedActivity>(`/activities/${id}`, { include_all_efforts: "true" });
}
