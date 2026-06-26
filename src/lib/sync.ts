// Sync orchestration: pull Hevy + Strava into the DB. Incremental where possible.
//
// - Hevy workouts: first run pulls all; later runs use /workouts/events?since=...
// - Hevy body measurements: small dataset, fully re-synced each run (upsert by date).
// - Strava: list activities after the last cursor; for each NEW run, fetch detail
//   once to capture best_efforts + splits + calories.

import { prisma } from "@/lib/db";
import {
  getAllWorkouts,
  getWorkoutEvents,
  getAllBodyMeasurements,
  type HevyWorkout,
} from "@/lib/hevy";
import { listActivities, getActivityDetail } from "@/lib/strava";

export interface SyncResult {
  hevy: { workoutsUpserted: number; workoutsDeleted: number; measurements: number };
  strava: { activitiesSeen: number; runsUpserted: number; detailsFetched: number; skipped?: string };
  startedAt: string;
  finishedAt: string;
}

function flattenSets(workout: HevyWorkout) {
  const performedAt = new Date(workout.start_time);
  const rows: {
    exerciseName: string;
    setIndex: number;
    weightKg: number | null;
    reps: number | null;
    performedAt: Date;
  }[] = [];
  for (const ex of workout.exercises) {
    for (const set of ex.sets) {
      // Skip warmups for "working set" derivations downstream, but keep all here;
      // metrics layer decides. We store everything except clearly empty rows.
      if (set.weight_kg == null && set.reps == null) continue;
      rows.push({
        exerciseName: ex.title,
        setIndex: set.index,
        weightKg: set.weight_kg,
        reps: set.reps,
        performedAt,
      });
    }
  }
  return rows;
}

async function upsertWorkout(workout: HevyWorkout) {
  const sets = flattenSets(workout);
  const raw = workout as unknown as object;
  await prisma.workout.upsert({
    where: { id: workout.id },
    create: {
      id: workout.id,
      title: workout.title,
      startTime: new Date(workout.start_time),
      endTime: workout.end_time ? new Date(workout.end_time) : null,
      raw,
    },
    update: {
      title: workout.title,
      startTime: new Date(workout.start_time),
      endTime: workout.end_time ? new Date(workout.end_time) : null,
      raw,
    },
  });
  // Replace this workout's sets wholesale (handles edits cleanly).
  await prisma.exerciseSet.deleteMany({ where: { workoutId: workout.id } });
  if (sets.length) {
    await prisma.exerciseSet.createMany({
      data: sets.map((s) => ({ ...s, workoutId: workout.id })),
    });
  }
}

async function syncHevy(): Promise<SyncResult["hevy"]> {
  const state = await prisma.syncState.findUnique({ where: { provider: "hevy" } });
  let workoutsUpserted = 0;
  let workoutsDeleted = 0;

  if (!state?.lastSyncedAt) {
    // First run: full pull.
    const workouts = await getAllWorkouts(10);
    for (const w of workouts) {
      await upsertWorkout(w);
      workoutsUpserted += 1;
    }
  } else {
    // Incremental: process events since last sync.
    const since = state.lastSyncedAt.toISOString();
    const events = await getWorkoutEvents(since, 10);
    for (const ev of events) {
      if (ev.type === "updated") {
        await upsertWorkout(ev.workout);
        workoutsUpserted += 1;
      } else {
        await prisma.workout.deleteMany({ where: { id: ev.id } });
        workoutsDeleted += 1;
      }
    }
  }

  // Body measurements: full upsert by date (small dataset).
  const measurements = await getAllBodyMeasurements(10);
  let measurementCount = 0;
  for (const m of measurements) {
    if (m.weight_kg == null) continue;
    const date = new Date(`${m.date}T00:00:00Z`);
    await prisma.bodyMeasurement.upsert({
      where: { date },
      create: { date, weightKg: m.weight_kg },
      update: { weightKg: m.weight_kg },
    });
    measurementCount += 1;
  }

  await prisma.syncState.upsert({
    where: { provider: "hevy" },
    create: { provider: "hevy", lastSyncedAt: new Date(), lastError: null },
    update: { lastSyncedAt: new Date(), lastError: null },
  });

  return { workoutsUpserted, workoutsDeleted, measurements: measurementCount };
}

async function syncStrava(): Promise<SyncResult["strava"]> {
  const token = await prisma.oAuthToken.findUnique({ where: { provider: "strava" } });
  if (!token) {
    return { activitiesSeen: 0, runsUpserted: 0, detailsFetched: 0, skipped: "not_connected" };
  }

  const state = await prisma.syncState.findUnique({ where: { provider: "strava" } });
  const afterEpoch = state?.cursor ? parseInt(state.cursor, 10) : 0;

  const activities = await listActivities(afterEpoch, 100);
  const runs = activities.filter((a) => a.sport_type === "Run" || a.type === "Run");

  let runsUpserted = 0;
  let detailsFetched = 0;
  let maxStartEpoch = afterEpoch;

  for (const run of runs) {
    const id = String(run.id);
    const startEpoch = Math.floor(new Date(run.start_date).getTime() / 1000);
    maxStartEpoch = Math.max(maxStartEpoch, startEpoch);

    const existing = await prisma.run.findUnique({ where: { id } });
    let bestEfforts: object | null = (existing?.bestEfforts as object) ?? null;
    let splits: object | null = (existing?.splits as object) ?? null;
    let calories: number | null = existing?.calories ?? null;
    // route polyline: prefer existing, else the low-res summary one we already have
    let polyline: string | null =
      existing?.polyline ?? run.map?.summary_polyline ?? null;
    let detailFetched = existing?.detailFetched ?? false;

    // Fetch detail once per run to get best_efforts / splits / calories / route.
    if (!detailFetched) {
      try {
        const detail = await getActivityDetail(id);
        bestEfforts = (detail.best_efforts as unknown as object) ?? null;
        splits = (detail.splits_metric as unknown as object) ?? null;
        calories = detail.calories ?? null;
        polyline = detail.map?.polyline ?? detail.map?.summary_polyline ?? polyline;
        detailFetched = true;
        detailsFetched += 1;
      } catch {
        // leave detailFetched false; next sync retries
      }
    }

    await prisma.run.upsert({
      where: { id },
      create: {
        id,
        name: run.name,
        type: run.sport_type || run.type,
        startDate: new Date(run.start_date),
        distanceM: run.distance,
        movingTimeS: run.moving_time,
        elapsedS: run.elapsed_time,
        calories,
        bestEfforts: bestEfforts ?? undefined,
        splits: splits ?? undefined,
        polyline,
        detailFetched,
      },
      update: {
        name: run.name,
        distanceM: run.distance,
        movingTimeS: run.moving_time,
        elapsedS: run.elapsed_time,
        calories,
        bestEfforts: bestEfforts ?? undefined,
        splits: splits ?? undefined,
        polyline,
        detailFetched,
      },
    });
    runsUpserted += 1;
  }

  await prisma.syncState.upsert({
    where: { provider: "strava" },
    create: {
      provider: "strava",
      lastSyncedAt: new Date(),
      cursor: String(maxStartEpoch),
      lastError: null,
    },
    update: { lastSyncedAt: new Date(), cursor: String(maxStartEpoch), lastError: null },
  });

  return { activitiesSeen: activities.length, runsUpserted, detailsFetched };
}

export async function runSync(): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  const hevy = await syncHevy();
  const strava = await syncStrava();
  return { hevy, strava, startedAt, finishedAt: new Date().toISOString() };
}
