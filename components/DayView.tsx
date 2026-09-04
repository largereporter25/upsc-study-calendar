'use client';

import { BLOCKS, BlockId, fmtHours } from '@/lib/blocks';
import { LogMap, dayTotal } from '@/lib/stats';
import type { TimerMode } from './FocusTimer';

interface Props {
  dateISO: string;
  logs: LogMap;
  targets: Record<BlockId, number>;
  today: string;
  onLogDelta: (date: string, block: BlockId, delta: number) => void;
  onFocus: (block: BlockId, mode: TimerMode) => void;
}

export default function DayView({ dateISO, logs, targets, today, onLogDelta, onFocus }: Props) {
  const d = new Date(dateISO + 'T00:00:00');
  const heading = d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const total = dayTotal(logs, dateISO);
  const targetTotal = BLOCKS.reduce((s, b) => s + targets[b.id], 0);
  const isToday = dateISO === today;

  return (
    <div className="day-sheet">
      <div className="day-sheet-head">
        <h2>{heading}</h2>
        {isToday && (
          <span className="micro" style={{ color: 'var(--color-accent)' }}>
            Today
          </span>
        )}
        <span className="day-sum num">
          {fmtHours(total)} logged · plan {fmtHours(targetTotal)}
        </span>
      </div>
      <div className="block-grid">
        {BLOCKS.map((b) => {
          const mins = logs[dateISO]?.[b.id] ?? 0;
          const target = targets[b.id];
          const frac = target > 0 ? Math.min(1, mins / target) : 0;
          return (
            <article
              key={b.id}
              className="block-card"
              style={{ ['--block-color' as string]: `var(${b.colorVar})` }}
            >
              <h3>{b.label}</h3>
              <p className="detail">{b.detail}</p>
              <div className="block-hours num">{fmtHours(mins)}</div>
              <div
                className="block-target-bar"
                role="progressbar"
                aria-valuenow={mins}
                aria-valuemax={target}
                aria-label={`${b.label} minutes vs target`}
              >
                <div className="block-target-fill" style={{ width: `${frac * 100}%` }} />
              </div>
              <div className="block-target-label num">target {fmtHours(target)} / day</div>
              <div className="block-actions">
                <button
                  className="chip-btn"
                  onClick={() => onLogDelta(dateISO, b.id, -15)}
                  aria-label={`Remove 15 minutes from ${b.label}`}
                >
                  −15
                </button>
                <button
                  className="chip-btn"
                  onClick={() => onLogDelta(dateISO, b.id, 15)}
                  aria-label={`Add 15 minutes to ${b.label}`}
                >
                  +15
                </button>
              </div>
              {isToday && (
                <div className="block-timers">
                  <button
                    className="chip-btn focus-btn"
                    onClick={() => onFocus(b.id, 'study')}
                    aria-label={`Start a Pomodoro study timer for ${b.label}`}
                  >
                    Study
                  </button>
                  <button
                    className="chip-btn focus-btn alt"
                    onClick={() => onFocus(b.id, 'focus')}
                    aria-label={`Start an open-ended focus timer for ${b.label}`}
                  >
                    Focus
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
