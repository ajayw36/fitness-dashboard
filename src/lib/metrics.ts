// Derive all dashboard view-data from stored rows. Server-only (uses Prisma).

import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  distanceUnitLabel,
  formatDuration,
  formatPace,
  kgToDisplay,
  metersToDistance,
  paceUnitLabel,
  round,
  weightUnitLabel,
  type UnitSystem,
} from "@/lib/format";
import type { StravaBestEffort, StravaSplit } from "@/lib/strava";

// ---------- view-model ----------

export interface DashboardData {
  topStats: {
    weekMileage: number;
    volume: number;
    volumeUnit: string;
    weekStreak: number;
    distanceUnit: string;
  };
  bodyWeight: {
    current: number | null;
    goal: number | null;
    unit: string;
    changeSinceFirst: number | null;
    firstLabel: string | null;
    series: { date: string; label: string; weight: number; goal: number | null }[];
  };
  cards: {
    bench: { value: number | null; goal: number | null; unit: string; pct: number | null; delta: number | null };
    bodyweight: { value: number | null; goal: number | null; unit: string; pct: number | null };
    fiveK: { seconds: number | null; goalSeconds: number | null; label: string; dateLabel: string | null; pct: number | null };
  };
  currentLifts: { name: string; weight: number | null; unit: string; delta: number | null; reps: number | null }[];
  weeklyMileage: { weekLabel: string; miles: number; isCurrent: boolean }[];
  latestRun: {
    name: string;
    dateLabel: string;
    distance: number;
    distanceUnit: string;
    durationLabel: string;
    paceLabel: string;
    paceUnit: string;
    polyline: string | null;
    splits: { idx: number; paceSec: number; label: string }[];
  } | null;
  calendar: {
    monthLabel: string;
    weeks: ({
      day: number;
      liftLabel: string | null;
      runLabel: string | null;
      kind: "lift" | "run" | "both" | null;
      iso: string;
    } | null)[][];
    workoutCount: number;
  };
  hasData: boolean;
}

// ---------- date helpers (local time, Monday-start weeks) ----------

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeekMonday(d: Date): Date {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - day);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ---------- main ----------

export async function getDashboardData(now: Date = new Date()): Promise<DashboardData> {
  const settings = await getSettings();
  const unit = settings.unit;

  const [measurements, runs, benchSets, allSets, workouts] = await Promise.all([
    prisma.bodyMeasurement.findMany({ orderBy: { date: "asc" } }),
    prisma.run.findMany({ orderBy: { startDate: "asc" } }),
    prisma.exerciseSet.findMany({
      where: { exerciseName: settings.benchExercise, weightKg: { not: null } },
      orderBy: { performedAt: "asc" },
    }),
    prisma.exerciseSet.findMany({
      where: { exerciseName: { in: settings.keyLifts }, weightKg: { not: null } },
      orderBy: { performedAt: "asc" },
    }),
    prisma.workout.findMany({ orderBy: { startTime: "asc" } }),
  ]);

  const hasData = measurements.length + runs.length + workouts.length > 0;

  // ----- top stats -----
  const weekStart = startOfWeekMonday(now);
  const weekMileageM = runs
    .filter((r) => r.startDate >= weekStart)
    .reduce((sum, r) => sum + r.distanceM, 0);

  // volume lifted this week = sum(weight × reps) across all sets since Monday.
  const weekSets = await prisma.exerciseSet.findMany({
    where: { performedAt: { gte: weekStart }, weightKg: { not: null }, reps: { not: null } },
  });
  const volumeKg = weekSets.reduce((s, x) => s + (x.weightKg ?? 0) * (x.reps ?? 0), 0);
  const volume = Math.round(kgToDisplay(volumeKg, unit));

  // week streak: consecutive weeks (Mon-start) with any activity, ending this
  // week, with a 1-week grace if this week has nothing logged yet.
  const activeWeeks = new Set<string>();
  for (const w of workouts) activeWeeks.add(dayKey(startOfWeekMonday(w.startTime)));
  for (const r of runs) activeWeeks.add(dayKey(startOfWeekMonday(r.startDate)));
  let weekStreak = 0;
  let weekCursor = startOfWeekMonday(now);
  if (!activeWeeks.has(dayKey(weekCursor))) weekCursor = addDays(weekCursor, -7); // grace
  while (activeWeeks.has(dayKey(weekCursor))) {
    weekStreak += 1;
    weekCursor = addDays(weekCursor, -7);
  }

  // ----- body weight -----
  const goalW = settings.goalWeightKg != null ? round(kgToDisplay(settings.goalWeightKg, unit)) : null;
  const bwSeries = measurements.map((m) => ({
    date: dayKey(m.date),
    label: `${MONTHS[m.date.getMonth()]} ${m.date.getDate()}`,
    weight: round(kgToDisplay(m.weightKg, unit)),
    goal: goalW,
  }));
  const currentW = bwSeries.length ? bwSeries[bwSeries.length - 1].weight : null;
  const firstW = bwSeries.length ? bwSeries[0].weight : null;
  const changeSinceFirst = currentW != null && firstW != null ? round(currentW - firstW) : null;

  // ----- bench card (value = all-time heaviest set, goal = configured goal) -----
  const benchMaxKg = benchSets.reduce((m, s) => Math.max(m, s.weightKg ?? 0), 0);
  const benchValue = benchSets.length ? round(kgToDisplay(benchMaxKg, unit)) : null;
  const benchGoal = settings.benchGoalKg != null ? round(kgToDisplay(settings.benchGoalKg, unit)) : null;

  // ----- 5K card -----
  const best5k = bestFiveK(runs);

  // ----- current lifts -----
  const currentLifts = settings.keyLifts
    .map((name) => {
      const sets = allSets.filter((s) => s.exerciseName === name);
      const sessions = topSetPerSession(sets);
      if (!sessions.length) return null;
      const last = sessions[sessions.length - 1];
      const prev = sessions.length > 1 ? sessions[sessions.length - 2] : null;
      const weight = round(kgToDisplay(last.topKg, unit));
      const delta = prev ? round(weight - round(kgToDisplay(prev.topKg, unit))) : null;
      return { name, weight, unit: weightUnitLabel(unit), delta, reps: last.reps };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // ----- weekly mileage (last 8 weeks) -----
  const weeklyMileage = lastNWeeksMileage(runs, now, unit, 8);

  // ----- latest run -----
  const latestRun = buildLatestRun(runs, unit);

  // ----- calendar (current month) -----
  const calendar = buildCalendar(now, workouts, runs, unit);

  return {
    topStats: {
      weekMileage: round(metersToDistance(weekMileageM, unit)),
      volume,
      volumeUnit: weightUnitLabel(unit),
      weekStreak,
      distanceUnit: distanceUnitLabel(unit),
    },
    bodyWeight: {
      current: currentW,
      goal: goalW,
      unit: weightUnitLabel(unit),
      changeSinceFirst,
      firstLabel: bwSeries.length ? bwSeries[0].label : null,
      series: bwSeries,
    },
    cards: {
      bench: {
        value: benchValue,
        goal: benchGoal,
        unit: weightUnitLabel(unit),
        pct: benchValue != null && benchGoal ? Math.min(100, Math.round((benchValue / benchGoal) * 100)) : null,
        delta: null,
      },
      bodyweight: {
        value: currentW,
        goal: goalW,
        unit: weightUnitLabel(unit),
        pct: currentW != null && goalW ? Math.min(100, Math.round((goalW / currentW) * 100)) : null,
      },
      fiveK: {
        seconds: best5k?.seconds ?? null,
        goalSeconds: settings.fiveKGoalSec,
        label: best5k ? formatDuration(best5k.seconds) : "—",
        dateLabel: best5k?.dateLabel ?? null,
        pct:
          best5k && settings.fiveKGoalSec
            ? Math.min(100, Math.round((settings.fiveKGoalSec / best5k.seconds) * 100))
            : null,
      },
    },
    currentLifts,
    weeklyMileage,
    latestRun,
    calendar,
    hasData,
  };
}

// ---------- derivations ----------

interface SessionTop {
  dayKey: string;
  topKg: number;
  reps: number | null;
}

/** For each distinct session day, the heaviest set (and its reps). */
function topSetPerSession(sets: { weightKg: number | null; reps: number | null; performedAt: Date }[]): SessionTop[] {
  const byDay = new Map<string, SessionTop>();
  for (const s of sets) {
    if (s.weightKg == null) continue;
    const k = dayKey(s.performedAt);
    const cur = byDay.get(k);
    if (!cur || s.weightKg > cur.topKg) {
      byDay.set(k, { dayKey: k, topKg: s.weightKg, reps: s.reps });
    }
  }
  return [...byDay.values()].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

/** Best 5K time from runs' best_efforts (prefers pr_rank===1, else min elapsed). */
function bestFiveK(runs: { startDate: Date; bestEfforts: unknown }[]): { seconds: number; dateLabel: string } | null {
  let best: { seconds: number; date: Date } | null = null;
  for (const run of runs) {
    const efforts = run.bestEfforts as StravaBestEffort[] | null;
    if (!Array.isArray(efforts)) continue;
    for (const e of efforts) {
      if (!/^5k$/i.test(e.name)) continue;
      const seconds = e.elapsed_time;
      if (e.pr_rank === 1) {
        return { seconds, dateLabel: `${MONTHS[run.startDate.getMonth()]} ${run.startDate.getDate()}` };
      }
      if (!best || seconds < best.seconds) best = { seconds, date: run.startDate };
    }
  }
  return best
    ? { seconds: best.seconds, dateLabel: `${MONTHS[best.date.getMonth()]} ${best.date.getDate()}` }
    : null;
}

function lastNWeeksMileage(
  runs: { startDate: Date; distanceM: number }[],
  now: Date,
  unit: UnitSystem,
  n: number,
): DashboardData["weeklyMileage"] {
  const thisWeek = startOfWeekMonday(now);
  const out: DashboardData["weeklyMileage"] = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const end = addDays(start, 7);
    const meters = runs
      .filter((r) => r.startDate >= start && r.startDate < end)
      .reduce((s, r) => s + r.distanceM, 0);
    out.push({
      weekLabel: `${MONTHS[start.getMonth()]} ${start.getDate()}`,
      miles: round(metersToDistance(meters, unit)),
      isCurrent: i === 0,
    });
  }
  return out;
}

function buildLatestRun(
  runs: {
    name: string;
    startDate: Date;
    distanceM: number;
    movingTimeS: number;
    splits: unknown;
    polyline: string | null;
  }[],
  unit: UnitSystem,
): DashboardData["latestRun"] {
  if (!runs.length) return null;
  const run = runs[runs.length - 1];
  const splitsRaw = run.splits as StravaSplit[] | null;
  const splits =
    Array.isArray(splitsRaw) && splitsRaw.length
      ? splitsRaw.map((sp, i) => ({
          idx: i + 1,
          // pace seconds per display unit for this split
          paceSec: sp.average_speed > 0 ? 1 / (sp.average_speed * metersToDistance(1, unit)) : 0,
          label: `${i + 1}`,
        }))
      : [];
  return {
    name: run.name,
    dateLabel: `${MONTHS[run.startDate.getMonth()]} ${run.startDate.getDate()}`,
    distance: round(metersToDistance(run.distanceM, unit)),
    distanceUnit: distanceUnitLabel(unit),
    durationLabel: formatDuration(run.movingTimeS),
    paceLabel: formatPace(run.distanceM, run.movingTimeS, unit),
    paceUnit: paceUnitLabel(unit),
    polyline: run.polyline,
    splits,
  };
}

function buildCalendar(
  now: Date,
  workouts: { title: string; startTime: Date }[],
  runs: { startDate: Date; distanceM: number }[],
  unit: UnitSystem,
): DashboardData["calendar"] {
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const liftByDay = new Map<string, string>();
  for (const w of workouts) {
    if (w.startTime.getFullYear() === year && w.startTime.getMonth() === month) {
      liftByDay.set(dayKey(w.startTime), w.title);
    }
  }
  // total run distance per day (so a run shows even on lift days)
  const runMetersByDay = new Map<string, number>();
  for (const r of runs) {
    if (r.startDate.getFullYear() === year && r.startDate.getMonth() === month) {
      const k = dayKey(r.startDate);
      runMetersByDay.set(k, (runMetersByDay.get(k) ?? 0) + r.distanceM);
    }
  }
  const du = distanceUnitLabel(unit);

  const leading = (first.getDay() + 6) % 7; // Monday-start offset
  const cells: DashboardData["calendar"]["weeks"][number] = [];
  const weeks: DashboardData["calendar"]["weeks"] = [];
  let row: typeof cells = [];
  for (let i = 0; i < leading; i++) row.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const k = dayKey(d);
    const hasLift = liftByDay.has(k);
    const hasRun = runMetersByDay.has(k);
    const kind: "lift" | "run" | "both" | null = hasLift && hasRun ? "both" : hasLift ? "lift" : hasRun ? "run" : null;
    const liftLabel = hasLift ? liftByDay.get(k)! : null;
    const runLabel = hasRun ? `${round(metersToDistance(runMetersByDay.get(k)!, unit))} ${du}` : null;
    row.push({ day, liftLabel, runLabel, kind, iso: k });
    if (row.length === 7) {
      weeks.push(row);
      row = [];
    }
  }
  if (row.length) {
    while (row.length < 7) row.push(null);
    weeks.push(row);
  }

  const workoutCount = new Set([...liftByDay.keys(), ...runMetersByDay.keys()]).size;
  return { monthLabel: `${first.toLocaleString("en-US", { month: "long" })} ${year}`, weeks, workoutCount };
}
