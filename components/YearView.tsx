'use client';

import { BLOCK_IDS, BlockId, fmtHours, toISODate } from '@/lib/blocks';
import { LogMap, dayTotal } from '@/lib/stats';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

interface Props {
  year: number;
  logs: LogMap;
  targets: Record<BlockId, number>;
  today: string;
  onOpenMonth: (e: React.MouseEvent, year: number, month: number) => void;
}

export default function YearView({ year, logs, targets, today, onOpenMonth }: Props) {
  const fullTarget = BLOCK_IDS.reduce((s, b) => s + targets[b], 0);

  return (
    <div className="year-grid">
      {MONTHS.map((name, m) => {
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        let monthTotal = 0;
        const cells = Array.from({ length: daysInMonth }, (_, i) => {
          const iso = toISODate(new Date(year, m, i + 1));
          const mins = dayTotal(logs, iso);
          monthTotal += mins;
          const intensity = fullTarget > 0 ? Math.min(1, mins / fullTarget) : 0;
          return { iso, mins, intensity, isToday: iso === today };
        });

        return (
          <button
            key={name}
            className="month-card"
            onClick={(e) => onOpenMonth(e, year, m)}
            aria-label={`Open ${name} ${year} — ${fmtHours(monthTotal)} studied`}
          >
            <div className="month-card-head">
              <h3>{name}</h3>
              <span className="num">{monthTotal > 0 ? fmtHours(monthTotal) : '—'}</span>
            </div>
            <div className="mini-days">
              {cells.map((c) => (
                <span
                  key={c.iso}
                  className={`mini-day${c.isToday ? ' today-dot' : ''}`}
                  style={
                    c.intensity > 0
                      ? {
                          background: `color-mix(in oklab, var(--color-text) ${Math.round(
                            12 + c.intensity * 88
                          )}%, var(--color-surface-offset))`,
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
