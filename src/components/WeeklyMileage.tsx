"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { DashboardData } from "@/lib/metrics";
import { SectionLabel } from "@/components/ui";

export function WeeklyMileage({
  data,
  unit,
}: {
  data: DashboardData["weeklyMileage"];
  unit: string;
}) {
  const total = data.reduce((s, d) => s + d.miles, 0);
  return (
    <div>
      <div className="flex items-center justify-between">
        <SectionLabel>Weekly Mileage</SectionLabel>
        <span className="tnum text-xs text-muted">
          {data.length} wk · {Math.round(total * 10) / 10} {unit}
        </span>
      </div>
      <div className="mt-3 h-28 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="weekLabel"
              tick={{ fill: "#5c6150", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <Tooltip
              cursor={{ fill: "rgba(205,250,62,0.06)" }}
              contentStyle={{
                background: "#101208",
                border: "1px solid #303620",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#8a8f7a" }}
              itemStyle={{ color: "#e9ecdf" }}
              formatter={(v) => [`${v} ${unit}`, "Distance"]}
            />
            <Bar dataKey="miles" radius={[3, 3, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.isCurrent ? "#cdfa3e" : "#3c4426"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
