import type { DashboardData } from "@/lib/metrics";
import { Card, SectionLabel } from "@/components/ui";

export function CurrentLifts({ lifts }: { lifts: DashboardData["currentLifts"] }) {
  return (
    <Card className="h-full">
      <div className="flex items-center justify-between">
        <SectionLabel>Current Lifts</SectionLabel>
        <span className="text-[11px] text-faint">Top Working Set</span>
      </div>
      <ul className="mt-4 divide-y divide-border">
        {lifts.length === 0 && (
          <li className="py-6 text-center text-sm text-faint">No lift data yet</li>
        )}
        {lifts.map((lift) => (
          <li key={lift.name} className="flex items-center justify-between py-3">
            <span className="text-sm text-text">{shorten(lift.name)}</span>
            <span className="tnum text-sm font-semibold text-text">
              {lift.weight} {lift.unit}
              {lift.reps != null && (
                <span className="text-muted"> × {lift.reps}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// Drop the parenthetical equipment suffix for a tighter list.
function shorten(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "");
}
