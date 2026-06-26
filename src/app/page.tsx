import Link from "next/link";
import { getDashboardData, type DashboardData } from "@/lib/metrics";
import { Header } from "@/components/Header";
import { StatCard } from "@/components/StatCard";
import { BodyWeightChart } from "@/components/BodyWeightChart";
import { CurrentLifts } from "@/components/CurrentLifts";
import { WeeklyMileage } from "@/components/WeeklyMileage";
import { LatestRun } from "@/components/LatestRun";
import { WorkoutCalendar } from "@/components/WorkoutCalendar";
import { SyncButton } from "@/components/SyncButton";
import { Card, SectionLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let data: DashboardData | null = null;
  let error: string | null = null;
  try {
    data = await getDashboardData();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load data";
  }

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (error || !data) {
    return <Onboarding error={error} />;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <Header topStats={data.topStats} dateLabel={dateLabel} />

      <div className="mt-4 flex items-center justify-between">
        <Link href="/settings" className="text-xs text-muted hover:text-lime">
          Settings
        </Link>
        <SyncButton />
      </div>

      {!data.hasData && (
        <Card className="mt-4 border-lime/30">
          <p className="text-sm text-muted">
            No data yet. Click <span className="text-lime">Sync now</span> to pull from Hevy and
            Strava, or connect Strava in{" "}
            <Link href="/settings" className="text-lime underline">
              Settings
            </Link>
            .
          </p>
        </Card>
      )}

      {/* hero body-weight chart */}
      <div className="mt-6">
        <BodyWeightChart data={data.bodyWeight} />
      </div>

      {/* three stat cards */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Bench Press"
          value={`${data.cards.bench.value ?? "—"}`}
          suffix={data.cards.bench.unit}
          secondary={data.cards.bench.goal ? `${data.cards.bench.goal}` : null}
          pct={data.cards.bench.pct}
        />
        <StatCard
          label="Body Weight"
          value={`${data.cards.bodyweight.value ?? "—"}`}
          suffix={data.cards.bodyweight.unit}
          secondary={data.cards.bodyweight.goal ? `${data.cards.bodyweight.goal}` : null}
          pct={data.cards.bodyweight.pct}
        />
        <StatCard
          label="5K Time"
          value={data.cards.fiveK.label}
          secondary={
            data.cards.fiveK.goalSeconds
              ? `${Math.floor(data.cards.fiveK.goalSeconds / 60)}:${String(
                  data.cards.fiveK.goalSeconds % 60,
                ).padStart(2, "0")}`
              : null
          }
          pct={data.cards.fiveK.pct}
        />
      </div>

      {/* lifts + mileage (left) · latest run (right) */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <CurrentLifts lifts={data.currentLifts} />
          <Card>
            <WeeklyMileage data={data.weeklyMileage} unit={data.topStats.distanceUnit} />
          </Card>
        </div>
        <Card className="flex flex-col">
          {data.latestRun ? (
            <LatestRun run={data.latestRun} />
          ) : (
            <div>
              <SectionLabel>Latest Run</SectionLabel>
              <p className="mt-3 text-sm text-faint">No runs synced yet.</p>
            </div>
          )}
        </Card>
      </div>

      {/* calendar */}
      <div className="mt-4">
        <WorkoutCalendar calendar={data.calendar} />
      </div>

      <footer className="mt-8 text-center text-[11px] text-faint">
        Synced from Hevy &amp; Strava · auto-updates daily
      </footer>
    </main>
  );
}

function Onboarding({ error }: { error: string | null }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-5 py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">STRIDE</h1>
      <p className="mt-2 text-muted">Personal fitness dashboard — Hevy + Strava.</p>
      <Card className="mt-6">
        <SectionLabel>Setup needed</SectionLabel>
        <p className="mt-3 text-sm text-muted">
          The dashboard couldn&apos;t reach the database. Set{" "}
          <code className="text-lime">DATABASE_URL</code> in your environment, run{" "}
          <code className="text-lime">npm run db:push</code>, then reload.
        </p>
        {error && (
          <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-bg-elevated p-3 text-[11px] text-faint">
            {error}
          </pre>
        )}
      </Card>
    </main>
  );
}
