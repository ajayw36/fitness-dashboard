import { decodePolyline } from "@/lib/format";

// Renders a Strava route polyline as a glowing lime SVG path (no map tiles / API key).
export function RunMap({ polyline, className = "" }: { polyline: string; className?: string }) {
  const coords = decodePolyline(polyline);
  if (coords.length < 2) {
    return (
      <div className={`flex items-center justify-center text-xs text-faint ${className}`}>
        No route data
      </div>
    );
  }

  // Equirectangular projection (good enough for a single run's extent).
  const latMean = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const k = Math.cos((latMean * Math.PI) / 180);
  const pts = coords.map(([lat, lng]) => [lng * k, -lat] as [number, number]);

  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = Math.max(maxX - minX, 1e-6);
  const h = Math.max(maxY - minY, 1e-6);
  const pad = Math.max(w, h) * 0.06;
  const viewBox = `${minX - pad} ${minY - pad} ${w + 2 * pad} ${h + 2 * pad}`;

  const pointsStr = pts.map((p) => `${p[0]},${p[1]}`).join(" ");
  const dotR = Math.max(w, h) * 0.03;
  const start = pts[0];
  const end = pts[pts.length - 1];

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ filter: "drop-shadow(0 0 4px rgba(205,250,62,0.5))" }}
    >
      <polyline
        points={pointsStr}
        fill="none"
        stroke="#cdfa3e"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={start[0]} cy={start[1]} r={dotR} fill="#0a0b07" stroke="#cdfa3e" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <circle cx={end[0]} cy={end[1]} r={dotR} fill="#cdfa3e" />
    </svg>
  );
}
