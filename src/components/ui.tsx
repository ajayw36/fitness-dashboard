import { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-card p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
      {children}
    </span>
  );
}

export function Delta({ value, unit = "" }: { value: number | null; unit?: string }) {
  if (value === null || value === 0) {
    return <span className="text-faint tnum">—</span>;
  }
  const up = value > 0;
  return (
    <span className={`tnum text-xs font-semibold ${up ? "text-lime" : "text-muted"}`}>
      {up ? "▲" : "▼"} {Math.abs(value)}
      {unit}
    </span>
  );
}
