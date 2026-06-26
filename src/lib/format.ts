// Pure formatting + unit helpers, safe to use on client and server.

export type UnitSystem = "imperial" | "metric";

export const KG_TO_LB = 2.20462;
export const M_TO_MI = 1 / 1609.344;
export const M_TO_KM = 1 / 1000;

export function kgToDisplay(kg: number, unit: UnitSystem): number {
  return unit === "imperial" ? kg * KG_TO_LB : kg;
}

export function weightUnitLabel(unit: UnitSystem): string {
  return unit === "imperial" ? "lb" : "kg";
}

export function distanceUnitLabel(unit: UnitSystem): string {
  return unit === "imperial" ? "mi" : "km";
}

export function metersToDistance(m: number, unit: UnitSystem): number {
  return unit === "imperial" ? m * M_TO_MI : m * M_TO_KM;
}

/** Round to n decimals and return a number (no trailing zeros). */
export function round(n: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Format seconds as m:ss or h:mm:ss. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * Pace from meters + seconds, formatted as "m:ss" per mile or km.
 */
export function formatPace(distanceMeters: number, seconds: number, unit: UnitSystem): string {
  if (distanceMeters <= 0) return "—";
  const distance = metersToDistance(distanceMeters, unit);
  if (distance <= 0) return "—";
  const secPerUnit = seconds / distance;
  return formatDuration(secPerUnit);
}

export function paceUnitLabel(unit: UnitSystem): string {
  return unit === "imperial" ? "/mi" : "/km";
}

/** Decode a Google/Strava encoded polyline into [lat, lng] pairs. */
export function decodePolyline(str: string, precision = 5): [number, number][] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coords: [number, number][] = [];
  const factor = 10 ** precision;

  while (index < str.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lat / factor, lng / factor]);
  }
  return coords;
}
