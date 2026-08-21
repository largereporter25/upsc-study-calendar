import { BLOCK_IDS, BlockId, JOURNEY_START, MILESTONES, daysBetween } from './blocks';

export type LogMap = Record<string, Partial<Record<BlockId, number>>>;

export interface Ramp {
  start_date: string;
  start_hours: number;
  target_hours: number;
  ramp_weeks: number;
}

export function dayTotal(logs: LogMap, date: string): number {
  const day = logs[date];
  if (!day) return 0;
  return BLOCK_IDS.reduce((s, b) => s + (day[b] ?? 0), 0);
}

export function cumulativeByBlock(logs: LogMap): Record<BlockId, number> {
  const out = { gs_static: 0, gs_dynamic: 0, optional: 0, revision: 0, csat: 0 };
  for (const date of Object.keys(logs)) {
    for (const b of BLOCK_IDS) out[b] += logs[date][b] ?? 0;
  }
  return out;
}

/** Total days of the whole climb: journey start → prelims day. */
export function journeyDays(): number {
  return daysBetween(JOURNEY_START, MILESTONES.prelims);
}

/** Fraction of the journey elapsed by `today` (the pace line). */
export function paceFraction(today: string): number {
  const f = daysBetween(JOURNEY_START, today) / journeyDays();
  return Math.max(0, Math.min(1, f));
}

/**
 * Per-block climb fraction: cumulative minutes vs the total this block
 * needs across the whole journey (daily target × journey days).
 */
export function blockFraction(
  cumulative: Record<BlockId, number>,
  targets: Record<BlockId, number>,
  block: BlockId
): number {
  const required = targets[block] * journeyDays();
  if (required <= 0) return 0;
  return Math.max(0, Math.min(1, cumulative[block] / required));
}

/** Consecutive-day streak ending today (or yesterday if today is still blank). */
export function streak(logs: LogMap, today: string): number {
  const d = new Date(today + 'T00:00:00');
  if (dayTotal(logs, iso(d)) === 0) d.setDate(d.getDate() - 1);
  let n = 0;
  while (dayTotal(logs, iso(d)) > 0) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** Average minutes/day over the last 7 days (including today). */
export function weekAvgMinutes(logs: LogMap, today: string): number {
  const d = new Date(today + 'T00:00:00');
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += dayTotal(logs, iso(d));
    d.setDate(d.getDate() - 1);
  }
  return Math.round(sum / 7);
}

/** Today's target minutes from the ramp plan (5.25h rising to 8h). */
export function rampTargetMinutes(ramp: Ramp, today: string): number {
  const weeks = Math.max(0, daysBetween(ramp.start_date, today)) / 7;
  const t = Math.min(1, ramp.ramp_weeks > 0 ? weeks / ramp.ramp_weeks : 1);
  const hours = ramp.start_hours + (ramp.target_hours - ramp.start_hours) * t;
  return Math.round(hours * 60);
}

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}
