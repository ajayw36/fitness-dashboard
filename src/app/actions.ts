"use server";

import { revalidatePath } from "next/cache";
import { runSync } from "@/lib/sync";
import { setSetting, type AppSettings } from "@/lib/settings";

export async function syncNow(): Promise<{ ok: boolean; error?: string }> {
  try {
    await runSync();
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "sync_failed" };
  }
}

export async function saveSetting(
  key: keyof AppSettings,
  value: unknown,
): Promise<{ ok: boolean }> {
  await setSetting(key, value);
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

import { KG_TO_LB } from "@/lib/format";
import { redirect } from "next/navigation";

export async function saveSettingsForm(formData: FormData): Promise<void> {
  const unit = (formData.get("unit") as string) === "metric" ? "metric" : "imperial";
  await setSetting("unit", unit);

  const toKg = (raw: FormDataEntryValue | null): number | null => {
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    if (Number.isNaN(n)) return null;
    return unit === "imperial" ? n / KG_TO_LB : n;
  };

  await setSetting("goalWeightKg", toKg(formData.get("goalWeight")));
  await setSetting("benchGoalKg", toKg(formData.get("benchGoal")));

  const fiveK = formData.get("fiveKGoal") as string | null;
  if (fiveK && /^\d{1,2}:\d{2}$/.test(fiveK)) {
    const [m, s] = fiveK.split(":").map(Number);
    await setSetting("fiveKGoalSec", m * 60 + s);
  } else if (!fiveK) {
    await setSetting("fiveKGoalSec", null);
  }

  const bench = formData.get("benchExercise") as string | null;
  if (bench) await setSetting("benchExercise", bench);

  const keyLifts = formData.get("keyLifts") as string | null;
  if (keyLifts != null) {
    const list = keyLifts
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (list.length) await setSetting("keyLifts", list);
  }

  revalidatePath("/");
  redirect("/settings?saved=1");
}
