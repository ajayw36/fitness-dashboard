// App settings, persisted in the Setting key/value table, with sensible defaults.

import { prisma } from "@/lib/db";
import type { UnitSystem } from "@/lib/format";

export interface AppSettings {
  unit: UnitSystem;
  goalWeightKg: number | null;
  /** Exercise titles (as they appear in Hevy) to feature in "Current Lifts". */
  keyLifts: string[];
  /** Which exercise drives the Bench Press stat card. */
  benchExercise: string;
  /** Optional goal for the bench card, in kg. */
  benchGoalKg: number | null;
  /** Optional 5K goal time, in seconds. */
  fiveKGoalSec: number | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  unit: "imperial",
  goalWeightKg: null,
  keyLifts: [
    "Bench Press (Barbell)",
    "Shoulder Press (Dumbbell)",
    "Lat Pulldown (Cable)",
    "Squat (Barbell)",
    "Deadlift (Barbell)",
    "Bent Over Row (Barbell)",
  ],
  benchExercise: "Bench Press (Barbell)",
  benchGoalKg: null,
  fiveKGoalSec: null,
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const get = <T>(key: keyof AppSettings, fallback: T): T => {
    const v = map.get(key);
    return v === undefined || v === null ? fallback : (v as T);
  };
  return {
    unit: get("unit", DEFAULT_SETTINGS.unit),
    goalWeightKg: get("goalWeightKg", DEFAULT_SETTINGS.goalWeightKg),
    keyLifts: get("keyLifts", DEFAULT_SETTINGS.keyLifts),
    benchExercise: get("benchExercise", DEFAULT_SETTINGS.benchExercise),
    benchGoalKg: get("benchGoalKg", DEFAULT_SETTINGS.benchGoalKg),
    fiveKGoalSec: get("fiveKGoalSec", DEFAULT_SETTINGS.fiveKGoalSec),
  };
}

export async function setSetting(key: keyof AppSettings, value: unknown): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: value as object },
    update: { value: value as object },
  });
}
