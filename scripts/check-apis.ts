/**
 * Sanity-check the Hevy + Strava integrations against the live APIs.
 * Run:  npm run check:apis
 * Requires .env with HEVY_API_KEY (Hevy) and a connected Strava token in the DB
 * (DATABASE_URL set + OAuth completed) for the Strava portion.
 */
import "dotenv/config";
import { getAllWorkouts, getAllBodyMeasurements } from "../src/lib/hevy";
import { listActivities, getActivityDetail } from "../src/lib/strava";

function hr(label: string) {
  console.log(`\n=== ${label} ===`);
}

async function checkHevy() {
  hr("Hevy: workouts (first page)");
  try {
    const workouts = await getAllWorkouts(3);
    console.log(`fetched ${workouts.length} workouts`);
    const w = workouts[0];
    if (w) {
      console.log("latest:", {
        id: w.id,
        title: w.title,
        start_time: w.start_time,
        exercises: w.exercises.length,
        firstExercise: w.exercises[0]?.title,
        firstSet: w.exercises[0]?.sets[0],
      });
    }
  } catch (e) {
    console.error("Hevy workouts error:", (e as Error).message);
  }

  hr("Hevy: body measurements");
  try {
    const bm = await getAllBodyMeasurements(5);
    console.log(`fetched ${bm.length} measurements`);
    console.log("latest:", bm[0]);
  } catch (e) {
    console.error("Hevy body measurements error:", (e as Error).message);
  }
}

async function checkStrava() {
  hr("Strava: recent activities");
  try {
    const acts = await listActivities(0, 30);
    const runs = acts.filter((a) => a.sport_type === "Run" || a.type === "Run");
    console.log(`fetched ${acts.length} activities (${runs.length} runs)`);
    const latestRun = runs.sort((a, b) => +new Date(b.start_date) - +new Date(a.start_date))[0];
    if (latestRun) {
      console.log("latest run summary:", {
        id: latestRun.id,
        name: latestRun.name,
        distance_m: latestRun.distance,
        moving_time_s: latestRun.moving_time,
        start_date: latestRun.start_date,
      });
      hr("Strava: latest run detail (best_efforts / splits / calories)");
      const detail = await getActivityDetail(latestRun.id);
      console.log("calories:", detail.calories);
      console.log("splits_metric count:", detail.splits_metric?.length);
      console.log(
        "best_efforts:",
        detail.best_efforts?.map((b) => ({ name: b.name, time: b.elapsed_time, pr: b.pr_rank })),
      );
    }
  } catch (e) {
    console.error("Strava error:", (e as Error).message);
  }
}

async function main() {
  await checkHevy();
  await checkStrava();
  process.exit(0);
}

main();
