import type { DashboardData } from "@/lib/metrics";
import { SectionLabel } from "@/components/ui";
import { RunMap } from "@/components/RunMap";

export function LatestRun({ run }: { run: NonNullable<DashboardData["latestRun"]> }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <SectionLabel>Latest Run</SectionLabel>
        <span className="text-xs text-muted">{run.dateLabel}</span>
      </div>

      <h3 className="mt-2 text-lg font-semibold text-text">{run.name}</h3>

      {/* route map — the SVG is absolutely positioned to fill this box.
          iOS Safari ignores CSS height on a viewBox-only <svg> and sizes it
          from the polyline's aspect ratio instead (collapsing to ~0 on a
          wide route), so we give it a definite containing block to fill. */}
      <div className="relative mt-3 h-56 w-full overflow-hidden rounded-lg border border-border bg-bg-elevated lg:h-auto lg:flex-1">
        {run.polyline ? (
          <RunMap polyline={run.polyline} className="absolute inset-0 h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-faint">
            No GPS route for this run
          </div>
        )}
      </div>

      {/* stats */}
      <div className="mt-3 flex justify-between border-t border-border pt-3">
        <Metric label="Distance" value={`${run.distance} ${run.distanceUnit}`} />
        <Metric label="Time" value={run.durationLabel} />
        <Metric label="Pace" value={`${run.paceLabel} ${run.paceUnit}`} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-[0.12em] text-faint">{label}</span>
      <span className="tnum text-sm font-semibold text-text">{value}</span>
    </div>
  );
}
