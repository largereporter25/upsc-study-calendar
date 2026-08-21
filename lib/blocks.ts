export type BlockId = 'gs_static' | 'gs_dynamic' | 'optional' | 'revision' | 'csat';

export interface BlockDef {
  id: BlockId;
  label: string;
  short: string;
  detail: string;
  /** CSS variable name carrying the block colour */
  colorVar: string;
}

export const BLOCKS: BlockDef[] = [
  {
    id: 'gs_static',
    label: 'GS Static',
    short: 'GS-S',
    detail: 'Polity · History · Geography · Economy · NCERTs',
    colorVar: '--c-gs-static',
  },
  {
    id: 'gs_dynamic',
    label: 'GS Dynamic',
    short: 'GS-D',
    detail: 'Current affairs mapped to syllabus lines',
    colorVar: '--c-gs-dynamic',
  },
  {
    id: 'optional',
    label: 'Optional · PSIR',
    short: 'PSIR',
    detail: 'Political Science & International Relations',
    colorVar: '--c-optional',
  },
  {
    id: 'revision',
    label: 'Revision',
    short: 'REV',
    detail: 'Closed-book recall · notes consolidation',
    colorVar: '--c-revision',
  },
  {
    id: 'csat',
    label: 'CSAT',
    short: 'CSAT',
    detail: 'Weekly insurance — maths, comprehension, speed',
    colorVar: '--c-csat',
  },
];

export const BLOCK_IDS: BlockId[] = BLOCKS.map((b) => b.id);

/** Default daily target minutes per block (editable in settings). */
export const DEFAULT_TARGETS: Record<BlockId, number> = {
  gs_static: 120,
  gs_dynamic: 60,
  optional: 90,
  revision: 45,
  csat: 30,
};

/** Key exam milestones (official UPSC Calendar 2027). */
export const MILESTONES = {
  prelims: '2027-05-23',
  mains: '2027-08-20',
  notification: '2027-01-13',
};

/** Journey start for the Ascent — first day of logged preparation. */
export const JOURNEY_START = '2026-07-28';

export function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + 'T00:00:00');
  const b = new Date(toISO + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
