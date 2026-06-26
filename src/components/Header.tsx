import type { DashboardData } from "@/lib/metrics";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-end leading-none">
      <span className="tnum text-2xl font-bold text-text">{value}</span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
    </div>
  );
}

export function Header({
  topStats,
  dateLabel,
}: {
  topStats: DashboardData["topStats"];
  dateLabel: string;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-text">
          STRIDE
        </h1>
        <p className="mt-1 text-sm text-muted">{dateLabel}</p>
      </div>
      <div className="flex items-end gap-8">
        <Stat
          value={`${topStats.weekMileage} ${topStats.distanceUnit}`}
          label="This Week"
        />
        <Stat
          value={`${topStats.volume.toLocaleString()} ${topStats.volumeUnit}`}
          label="Volume"
        />
        <Stat value={`${topStats.weekStreak}`} label="Week Streak" />
      </div>
    </header>
  );
}
