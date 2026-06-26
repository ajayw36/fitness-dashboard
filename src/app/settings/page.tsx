import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { kgToDisplay, round, weightUnitLabel } from "@/lib/format";
import { saveSettingsForm } from "@/app/actions";
import { Card, SectionLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ strava?: string; saved?: string; detail?: string }>;
}) {
  const sp = await searchParams;

  let stravaConnected = false;
  let exerciseNames: string[] = [];
  let dbError: string | null = null;
  let settings = DEFAULT_SETTINGS;
  try {
    settings = await getSettings();
    const token = await prisma.oAuthToken.findUnique({ where: { provider: "strava" } });
    stravaConnected = !!token;
    const grouped = await prisma.exerciseSet.groupBy({
      by: ["exerciseName"],
      _count: { exerciseName: true },
      orderBy: { _count: { exerciseName: "desc" } },
      take: 30,
    });
    exerciseNames = grouped.map((g) => g.exerciseName);
  } catch (err) {
    dbError = err instanceof Error ? err.message : "db error";
  }

  const unit = settings.unit;
  const uLabel = weightUnitLabel(unit);
  const goalWeight =
    settings.goalWeightKg != null ? round(kgToDisplay(settings.goalWeightKg, unit)) : "";
  const benchGoal =
    settings.benchGoalKg != null ? round(kgToDisplay(settings.benchGoalKg, unit)) : "";
  const fiveK = settings.fiveKGoalSec
    ? `${Math.floor(settings.fiveKGoalSec / 60)}:${String(settings.fiveKGoalSec % 60).padStart(2, "0")}`
    : "";

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <div className="flex items-center justify-between border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xs text-muted hover:text-lime">
            ← Dashboard
          </Link>
          <a href="/api/logout" className="text-xs text-muted hover:text-lime">
            Sign out
          </a>
        </div>
      </div>

      {sp.saved && (
        <p className="mt-4 text-sm text-lime">Settings saved.</p>
      )}
      {sp.strava === "connected" && (
        <p className="mt-4 text-sm text-lime">Strava connected.</p>
      )}
      {sp.strava === "error" && (
        <p className="mt-4 text-sm text-red-400">Strava error: {sp.detail}</p>
      )}

      {/* Strava connection */}
      <Card className="mt-6">
        <SectionLabel>Strava</SectionLabel>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-muted">
            {stravaConnected ? "Connected ✓" : "Not connected"}
          </span>
          <a
            href="/api/auth/strava"
            className="rounded-md border border-border-strong bg-bg-elevated px-3 py-1.5 text-xs font-semibold text-text hover:border-lime/50 hover:text-lime"
          >
            {stravaConnected ? "Reconnect" : "Connect Strava"}
          </a>
        </div>
        {dbError && (
          <p className="mt-3 text-xs text-red-400">DB: {dbError}</p>
        )}
      </Card>

      {/* Goals + units form */}
      <form action={saveSettingsForm}>
        <Card className="mt-4 space-y-5">
          <SectionLabel>Goals &amp; Units</SectionLabel>

          <Field label="Units">
            <select
              name="unit"
              defaultValue={unit}
              className="rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm"
            >
              <option value="imperial">Imperial (lb, mi)</option>
              <option value="metric">Metric (kg, km)</option>
            </select>
          </Field>

          <Field label={`Goal body weight (${uLabel})`}>
            <input
              name="goalWeight"
              type="number"
              step="0.1"
              defaultValue={goalWeight}
              placeholder="e.g. 145"
              className="input"
            />
          </Field>

          <Field label="Bench exercise (as in Hevy)">
            <input
              name="benchExercise"
              defaultValue={settings.benchExercise}
              list="exercise-names"
              className="input"
            />
            <datalist id="exercise-names">
              {exerciseNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>

          <Field label={`Bench goal (${uLabel})`}>
            <input
              name="benchGoal"
              type="number"
              step="0.5"
              defaultValue={benchGoal}
              placeholder="e.g. 225"
              className="input"
            />
          </Field>

          <Field label="5K goal time (m:ss)">
            <input
              name="fiveKGoal"
              defaultValue={fiveK}
              placeholder="e.g. 22:30"
              className="input"
            />
          </Field>

          <Field label="Key lifts (one per line, exact Hevy names)">
            <textarea
              name="keyLifts"
              rows={6}
              defaultValue={settings.keyLifts.join("\n")}
              className="input font-mono text-xs"
            />
          </Field>

          <button
            type="submit"
            className="rounded-md bg-lime px-4 py-2 text-sm font-semibold text-bg hover:opacity-90"
          >
            Save settings
          </button>
        </Card>
      </form>

      {exerciseNames.length > 0 && (
        <Card className="mt-4">
          <SectionLabel>Exercises in your data</SectionLabel>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {exerciseNames.map((n) => (
              <span
                key={n}
                className="rounded-full border border-border bg-bg-elevated px-2.5 py-1 text-[11px] text-muted"
              >
                {n}
              </span>
            ))}
          </div>
        </Card>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
