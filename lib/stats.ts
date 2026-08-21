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

/* ============ Weather, projections, sentinel ============ */

export type WeatherKind = 'radiant' | 'clear' | 'clouds' | 'overcast' | 'storm';

export interface Weather {
  kind: WeatherKind;
  missedDays: number;
  weekRatio: number; // last-7-day minutes vs ramp targets
  label: string;
}

function isoShift(today: string, days: number): string {
  const d = new Date(today + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return iso(d);
}

/** Consecutive fully-idle days ending yesterday. */
export function idleDays(logs: LogMap, today: string): number {
  let n = 0;
  let d = isoShift(today, -1);
  while (dayTotal(logs, d) === 0 && n < 60) {
    n += 1;
    d = isoShift(d, -1);
  }
  return n;
}

/** The mountain's weather — it reacts to your last week. */
export function weather(logs: LogMap, ramp: Ramp, today: string): Weather {
  const missed = idleDays(logs, today);
  let done = 0;
  let planned = 0;
  for (let i = 0; i < 7; i++) {
    const d = isoShift(today, -i);
    done += dayTotal(logs, d);
    planned += rampTargetMinutes(ramp, d);
  }
  const ratio = planned > 0 ? done / planned : 0;
  const s = streak(logs, today);

  let kind: WeatherKind;
  if (missed >= 3) kind = 'storm';
  else if (ratio < 0.5) kind = 'overcast';
  else if (ratio < 0.85) kind = 'clouds';
  else if (ratio >= 1 && s >= 7) kind = 'radiant';
  else kind = 'clear';

  const label =
    kind === 'storm'
      ? `STORM — ${missed} idle days`
      : kind === 'overcast'
        ? `OVERCAST — ${Math.round(ratio * 100)}% of weekly plan`
        : kind === 'clouds'
          ? `CLOUDS — ${Math.round(ratio * 100)}% of weekly plan`
          : kind === 'radiant'
            ? `RADIANT — ${s}-day streak above target`
            : `CLEAR — ${Math.round(ratio * 100)}% of weekly plan`;

  return { kind, missedDays: missed, weekRatio: ratio, label };
}

/**
 * Where a climber will stand on Prelims day if the last 14 days' pace holds.
 * Returns a route fraction (may exceed the current fraction or hit 1).
 */
export function projectedFraction(
  logs: LogMap,
  cumulative: Record<BlockId, number>,
  targets: Record<BlockId, number>,
  block: BlockId,
  today: string
): number {
  const required = targets[block] * journeyDays();
  if (required <= 0) return 0;
  let recent = 0;
  for (let i = 0; i < 14; i++) {
    recent += logs[isoShift(today, -i)]?.[block] ?? 0;
  }
  const rate = recent / 14;
  const daysLeft = Math.max(0, daysBetween(today, MILESTONES.prelims));
  const projected = (cumulative[block] + rate * daysLeft) / required;
  return Math.max(0, Math.min(1, projected));
}

export interface Sentinel {
  daysSince: number;
  level: 'ok' | 'warn' | 'alert';
}

/** CSAT sentinel — CSAT is weekly insurance; fraying rope after idle week. */
export function csatSentinel(logs: LogMap, today: string): Sentinel {
  let daysSince = 0;
  let d = today;
  while ((logs[d]?.csat ?? 0) === 0 && daysSince < 90) {
    daysSince += 1;
    d = isoShift(d, -1);
  }
  const level = daysSince >= 7 ? 'alert' : daysSince >= 4 ? 'warn' : 'ok';
  return { daysSince, level };
}
