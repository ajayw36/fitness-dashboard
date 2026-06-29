import type { DashboardData } from "@/lib/metrics";
import { Card, SectionLabel } from "@/components/ui";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const KIND_STYLES: Record<string, string> = {
  lift: "border-lime/40 bg-lime/10 text-text",
  run: "border-lime/40 bg-lime/10 text-text",
  both: "border-lime/60 bg-lime/20 text-text",
};

export function WorkoutCalendar({ calendar }: { calendar: DashboardData["calendar"] }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <SectionLabel>Workout Calendar</SectionLabel>
        <span className="text-xs text-muted">
          {calendar.monthLabel} · {calendar.workoutCount} workouts
        </span>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {DOW.map((d) => (
          <div key={d} className="pb-1 text-[10px] uppercase tracking-[0.1em] text-faint">
            {d}
          </div>
        ))}
        {calendar.weeks.flat().map((cell, i) => {
          if (!cell) return <div key={i} className="aspect-square rounded-md" />;
          const style = cell.kind ? KIND_STYLES[cell.kind] : "border-border bg-transparent text-faint";
          return (
            <div
              key={i}
              className={`flex aspect-square flex-col justify-between rounded-md border p-1.5 ${style}`}
            >
              <div className="flex items-start justify-between">
                <span className="tnum text-[11px] leading-none">{cell.day}</span>
              </div>
              <div className="flex flex-col gap-0.5 leading-tight">
                {cell.liftLabel && (
                  <span className="truncate text-[9px] font-medium">🏋️ {cell.liftLabel}</span>
                )}
                {cell.runLabel && (
                  <span className="truncate text-[9px] font-medium text-lime">
                    🏃 {cell.runLabel}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
