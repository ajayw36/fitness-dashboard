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
  const projected = coords.map(([lat, lng]) => [lng * k, -lat] as [number, number]);

  const xs = projected.map((p) => p[0]);
  const ys = projected.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(Math.max(...xs) - minX, 1e-9);
  const h = Math.max(Math.max(...ys) - minY, 1e-9);

  // Normalize into a fixed 0..SCALE coordinate space. Raw lat/lng give huge
  // offsets with a sub-0.01 extent, which overflows the precision of WebKit's
  // SVG rasterizer — the route then collapses to nothing on iOS Safari while
  // rendering fine in Chrome. Remapping to a sane magnitude fixes both.
  const SCALE = 1000;
  const span = Math.max(w, h);
  const pts = projected.map(
    ([x, y]) => [((x - minX) / span) * SCALE, ((y - minY) / span) * SCALE] as [number, number],
  );

  const pad = SCALE * 0.06;
  const viewBox = `${-pad} ${-pad} ${(w / span) * SCALE + 2 * pad} ${(h / span) * SCALE + 2 * pad}`;

  const pointsStr = pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  const dotR = SCALE * 0.03;
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
