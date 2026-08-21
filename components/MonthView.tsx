'use client';

import { BLOCKS, BlockId, fmtHours, toISODate } from '@/lib/blocks';
import { LogMap, dayTotal } from '@/lib/stats';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Props {
  year: number;
  month: number; // 0-indexed
  logs: LogMap;
  targets: Record<BlockId, number>;
  today: string;
  onOpenDay: (e: React.MouseEvent, year: number, month: number, day: number) => void;
}

export default function MonthView({ year, month, logs, targets, today, onOpenDay }: Props) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first offset
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="dow-row">
        {DOW.map((d) => (
          <span key={d} className="dow micro">
            {d}
          </span>
        ))}
      </div>
      <div className="month-grid">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`e${i}`} className="day-cell is-empty" aria-hidden="true" />;
          }
          const iso = toISODate(new Date(year, month, day));
          const total = dayTotal(logs, iso);
          const isToday = iso === today;
          return (
            <button
              key={iso}
              className={`day-cell${isToday ? ' is-today' : ''}`}
              onClick={(e) => onOpenDay(e, year, month, day)}
              aria-label={`Open ${iso} — ${fmtHours(total)} studied`}
            >
              <div className="day-cell-top">
                <span className="day-num">{day}</span>
                {total > 0 && <span className="day-total">{fmtHours(total)}</span>}
              </div>
              <div className="day-bars" aria-hidden="true">
                {BLOCKS.map((b) => {
                  const mins = logs[iso]?.[b.id] ?? 0;
                  const frac = targets[b.id] > 0 ? Math.min(1, mins / targets[b.id]) : 0;
                  return (
                    <span
                      key={b.id}
                      className="day-bar"
                      style={
                        mins > 0
                          ? { height: `${Math.max(8, frac * 100)}%`, background: `var(${b.colorVar})` }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
