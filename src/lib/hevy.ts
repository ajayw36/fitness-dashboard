// Hevy API client. Docs: https://api.hevyapp.com/docs/
// Auth: `api-key` header (Hevy Pro). All weights are in kilograms.

const BASE = "https://api.hevyapp.com/v1";

export interface HevySet {
  index: number;
  type: string; // "normal" | "warmup" | "dropset" | "failure"
  weight_kg: number | null;
  reps: number | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  rpe: number | null;
  custom_metric: number | null;
}

export interface HevyExercise {
  index: number;
  title: string;
  notes: string;
  exercise_template_id: string;
  supersets_id: number | null;
  sets: HevySet[];
}

export interface HevyWorkout {
  id: string;
  title: string;
  description: string;
  routine_id?: string;
  start_time: string;
  end_time: string;
  updated_at: string;
  created_at: string;
  exercises: HevyExercise[];
}

export type HevyWorkoutEvent =
  | { type: "updated"; workout: HevyWorkout }
  | { type: "deleted"; id: string; deleted_at: string };

export interface HevyBodyMeasurement {
  date: string; // YYYY-MM-DD
  weight_kg: number | null;
  lean_mass_kg: number | null;
  fat_percent: number | null;
  [key: string]: number | string | null;
}

function apiKey(): string {
  const key = process.env.HEVY_API_KEY;
  if (!key) throw new Error("HEVY_API_KEY is not set");
  return key;
}

async function hevyGet<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    headers: { "api-key": apiKey(), accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Hevy ${path} -> ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Fetch all workouts, newest first, following pagination. */
export async function getAllWorkouts(pageSize = 10): Promise<HevyWorkout[]> {
  const out: HevyWorkout[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const data = await hevyGet<{
      page: number;
      page_count: number;
      workouts: HevyWorkout[];
    }>("/workouts", { page, pageSize });
    out.push(...data.workouts);
    pageCount = data.page_count;
    page += 1;
  } while (page <= pageCount);
  return out;
}

/**
 * Fetch workout events (updates + deletes) since a timestamp, for incremental sync.
 * `since` is an ISO 8601 string.
 */
export async function getWorkoutEvents(
  since: string,
  pageSize = 10,
): Promise<HevyWorkoutEvent[]> {
  const out: HevyWorkoutEvent[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    // Quirk: when there are events the API returns them under `events`; when
    // there are none it returns an empty `workouts` array instead.
    const data = await hevyGet<{
      page: number;
      page_count: number;
      events?: HevyWorkoutEvent[];
      workouts?: unknown[];
    }>("/workouts/events", { page, pageSize, since });
    const items = Array.isArray(data.events) ? data.events : [];
    out.push(...items);
    pageCount = data.page_count ?? 1;
    page += 1;
  } while (page <= pageCount);
  return out;
}

/** Fetch all body measurements (most recent first). */
export async function getAllBodyMeasurements(
  pageSize = 10,
): Promise<HevyBodyMeasurement[]> {
  const out: HevyBodyMeasurement[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const data = await hevyGet<{
      page: number;
      page_count: number;
      body_measurements: HevyBodyMeasurement[];
    }>("/body_measurements", { page, pageSize });
    out.push(...data.body_measurements);
    pageCount = data.page_count;
    page += 1;
  } while (page <= pageCount);
  return out;
}
