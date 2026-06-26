"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardData } from "@/lib/metrics";
import { Card, SectionLabel } from "@/components/ui";

const RANGES = [
  { key: "1M", months: 1 },
  { key: "3M", months: 3 },
  { key: "1Y", months: 12 },
  { key: "AT", months: null },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

export function BodyWeightChart({ data }: { data: DashboardData["bodyWeight"] }) {
  const [range, setRange] = useState<RangeKey>("3M");
  const goal = data.goal;

  const series = useMemo(() => {
    const months = RANGES.find((r) => r.key === range)?.months;
    if (months == null) return data.series;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const filtered = data.series.filter((d) => new Date(d.date) >= cutoff);
    // keep at least the two most recent points so the line never disappears
    return filtered.length >= 2 ? filtered : data.series.slice(-2);
  }, [data.series, range]);

  const values = series.map((d) => d.weight).concat(goal ? [goal] : []);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const pad = Math.max(2, (max - min) * 0.25);

  // change over the *visible* window
  const first = series.length ? series[0] : null;
  const change =
    data.current != null && first ? Math.round((data.current - first.weight) * 10) / 10 : null;
  const changeLabel =
    change != null
      ? `${change > 0 ? "↑" : change < 0 ? "↓" : ""} ${Math.abs(change)} ${data.unit} since ${first?.label ?? ""}`
      : null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <SectionLabel>Body Weight</SectionLabel>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tnum text-4xl font-bold text-text">{data.current ?? "—"}</span>
            <span className="text-sm text-muted">{data.unit}</span>
            {changeLabel && <span className="ml-1 text-xs text-muted">{changeLabel}</span>}
          </div>
        </div>
        {goal && (
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Goal</div>
            <div className="tnum text-lg font-semibold text-lime">
              {goal} {data.unit}
            </div>
          </div>
        )}
      </div>

      {/* timeframe toggle */}
      <div className="mt-3 flex gap-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
              range === r.key
                ? "bg-lime text-bg"
                : "border border-border text-muted hover:border-lime/40 hover:text-lime"
            }`}
          >
            {r.key}
          </button>
        ))}
      </div>

      <div className="glow-lime mt-3 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 10, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="bwFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#cdfa3e" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#cdfa3e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fill: "#8a8f7a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis hide domain={[min - pad, max + pad]} />
            {goal && (
              <ReferenceLine
                y={goal}
                stroke="#9bbd2e"
                strokeDasharray="5 5"
                strokeWidth={1.5}
                label={{ value: "GOAL", fill: "#9bbd2e", fontSize: 10, position: "insideTopLeft" }}
              />
            )}
            <Tooltip
              contentStyle={{
                background: "#101208",
                border: "1px solid #303620",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#8a8f7a" }}
              itemStyle={{ color: "#e9ecdf" }}
              formatter={(v) => [`${v} ${data.unit}`, "Weight"]}
            />
            <Area
              type="monotone"
              dataKey="weight"
              stroke="#cdfa3e"
              strokeWidth={2.5}
              fill="url(#bwFill)"
              dot={false}
              activeDot={{ r: 4, fill: "#cdfa3e", stroke: "#0a0b07" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
