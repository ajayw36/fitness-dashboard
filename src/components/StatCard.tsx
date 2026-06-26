import { Card, SectionLabel, Delta } from "@/components/ui";

export function StatCard({
  label,
  value,
  suffix,
  secondary,
  pct,
  delta,
  deltaUnit,
}: {
  label: string;
  value: string;
  suffix?: string;
  secondary?: string | null;
  pct: number | null;
  delta?: number | null;
  deltaUnit?: string;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <SectionLabel>{label}</SectionLabel>
        {delta !== undefined && <Delta value={delta ?? null} unit={deltaUnit} />}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="tnum text-3xl font-bold text-text">{value}</span>
        {suffix && <span className="text-sm text-muted">{suffix}</span>}
        {secondary && (
          <span className="ml-1 text-sm text-faint">/ {secondary}</span>
        )}
      </div>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-lime transition-all"
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
      <div className="mt-1.5 text-right">
        <span className="tnum text-[11px] text-muted">
          {pct != null ? `${pct}%` : "set a goal"}
        </span>
      </div>
    </Card>
  );
}
