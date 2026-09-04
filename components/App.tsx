'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BLOCKS,
  BLOCK_IDS,
  BlockId,
  DEFAULT_TARGETS,
  MILESTONES,
  fmtHours,
  toISODate,
  daysBetween,
} from '@/lib/blocks';
import {
  LogMap,
  Ramp,
  csatSentinel,
  cumulativeByBlock,
  dayTotal,
  paceFraction,
  projectedFraction,
  rampTargetMinutes,
  streak,
  weather,
  weekAvgMinutes,
} from '@/lib/stats';
import Ascent from './Ascent';
import YearView from './YearView';
import MonthView from './MonthView';
import DayView from './DayView';
import FocusTimer, { TimerMode } from './FocusTimer';
import RevisionQueue from './RevisionQueue';
import Soundscape from './Soundscape';

type ViewLevel = 'year' | 'month' | 'day';

interface ViewState {
  level: ViewLevel;
  year: number;
  month: number; // 0-indexed
  day: number;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function App() {
  const today = toISODate(new Date());
  const todayDate = new Date(today + 'T00:00:00');

  const [logs, setLogs] = useState<LogMap>({});
  const [targets, setTargets] = useState<Record<BlockId, number>>(DEFAULT_TARGETS);
  const [ramp, setRamp] = useState<Ramp>({
    start_date: '2026-08-21',
    start_hours: 5.25,
    target_hours: 8,
    ramp_weeks: 16,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [view, setView] = useState<ViewState>({
    level: 'month',
    year: todayDate.getFullYear(),
    month: todayDate.getMonth(),
    day: todayDate.getDate(),
  });
  const [timer, setTimer] = useState<{ block: BlockId; mode: TimerMode } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  /* ---------- boot ---------- */
  useEffect(() => {
    setTheme(
      (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') ?? 'light'
    );
    fetch('/api/state')
      .then((r) => {
        if (!r.ok) throw new Error('bad response');
        return r.json();
      })
      .then((data) => {
        const map: LogMap = {};
        for (const row of data.logs as { date: string; block: BlockId; minutes: number }[]) {
          (map[row.date] ??= {})[row.block] = row.minutes;
        }
        setLogs(map);
        if (data.settings?.daily_target_minutes) setTargets(data.settings.daily_target_minutes);
        if (data.settings?.ramp) setRamp(data.settings.ramp);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not reach the database. Your entries will not be saved right now.');
        setLoading(false);
      });
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  /* ---------- mutations ---------- */
  const applyLocal = useCallback((date: string, block: BlockId, minutes: number) => {
    setLogs((prev) => ({ ...prev, [date]: { ...prev[date], [block]: minutes } }));
  }, []);

  const logDelta = useCallback(
    (date: string, block: BlockId, delta: number) => {
      // Optimistic update via functional setState (safe under rapid clicks).
      setLogs((prev) => {
        const current = prev[date]?.[block] ?? 0;
        const next = Math.max(0, Math.min(960, current + delta));
        return { ...prev, [date]: { ...prev[date], [block]: next } };
      });
      // Server-side atomic increment — no lost updates between clicks.
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, block, delta }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.minutes === 'number') applyLocal(date, block, data.minutes);
        })
        .catch(() => setError('Save failed — check your connection.'));
    },
    [applyLocal]
  );

  /** Called by the timer when a work interval was logged server-side already. */
  const creditSession = useCallback(
    (date: string, block: BlockId, addedMinutes: number) => {
      setLogs((prev) => {
        const current = prev[date]?.[block] ?? 0;
        return { ...prev, [date]: { ...prev[date], [block]: current + addedMinutes } };
      });
    },
    []
  );

  /* ---------- derived ---------- */
  const cumulative = useMemo(() => cumulativeByBlock(logs), [logs]);
  const pace = paceFraction(today);
  const todayMinutes = dayTotal(logs, today);
  const todayTarget = rampTargetMinutes(ramp, today);
  const currentStreak = useMemo(() => streak(logs, today), [logs, today]);
  const weekAvg = useMemo(() => weekAvgMinutes(logs, today), [logs, today]);
  const wx = useMemo(() => weather(logs, ramp, today), [logs, ramp, today]);
  const projections = useMemo(() => {
    const out = {} as Record<BlockId, number>;
    for (const b of BLOCK_IDS) {
      out[b] = projectedFraction(logs, cumulative, targets, b, today);
    }
    return out;
  }, [logs, cumulative, targets, today]);
  const csat = useMemo(() => csatSentinel(logs, today), [logs, today]);
  const totalMinutes = BLOCK_IDS.reduce((s, b) => s + cumulative[b], 0);
  const daysToPrelims = daysBetween(today, MILESTONES.prelims);
  const daysToMains = daysBetween(today, MILESTONES.mains);

  /* ---------- navigation ---------- */
  const zoomFrom = (e: React.MouseEvent) => {
    const frame = frameRef.current;
    if (!frame) return;
    const r = frame.getBoundingClientRect();
    frame.style.setProperty(
      '--zoom-origin',
      `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}% ${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`
    );
  };

  const openMonth = (e: React.MouseEvent, year: number, month: number) => {
    zoomFrom(e);
    setView({ level: 'month', year, month, day: 1 });
  };

  const openDay = (e: React.MouseEvent, year: number, month: number, day: number) => {
    zoomFrom(e);
    setView({ level: 'day', year, month, day });
  };

  const collapseTo = (level: ViewLevel) => setView((v) => ({ ...v, level }));

  const shiftMonth = (dir: number) => {
    setView((v) => {
      const d = new Date(v.year, v.month + dir, 1);
      return { ...v, year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const shiftDay = (dir: number) => {
    setView((v) => {
      const d = new Date(v.year, v.month, v.day + dir);
      return { level: 'day', year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
    });
  };

  const selectedDayISO = toISODate(new Date(view.year, view.month, view.day));

  /* ---------- render ---------- */
  if (loading) {
    return (
      <div className="boot">
        <Logo size={44} className="boot-mark" />
        <p className="micro">Loading the climb…</p>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <Logo size={30} />
          <div>
            <div className="brand-name">Ascent</div>
            <div className="brand-sub">UPSC CSE 2027 · Study Calendar</div>
          </div>
        </div>
        <div className="topbar-right">
          <div className="countdown-chip accent">
            <strong className="num">{daysToPrelims}</strong>
            <span>days · Prelims 23 May</span>
          </div>
          <div className="countdown-chip">
            <strong className="num">{daysToMains}</strong>
            <span>days · Mains 20 Aug</span>
          </div>
          <button
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {error && <div className="error-note">{error}</div>}

      <section className="ascent-panel" aria-label="Ascent to AIR 1">
        <div className="panel-head">
          <h2>The Ascent</h2>
          <p className="micro">
            Summit · AIR 1 · 23 May 2027 — route is {Math.round(pace * 100)}% elapsed
          </p>
        </div>
        <Ascent
          cumulative={cumulative}
          targets={targets}
          pace={pace}
          weather={wx}
          projections={projections}
          csat={csat}
        />
        <div className="legend">
          {BLOCKS.map((b) => (
            <div className="legend-item" key={b.id}>
              <span className="legend-swatch" style={{ background: `var(${b.colorVar})` }} />
              {b.label}
              <span className="num">{fmtHours(cumulative[b.id])}</span>
            </div>
          ))}
          <div className="legend-item">
            <span
              className="legend-swatch"
              style={{
                background: 'transparent',
                border: '1.5px dashed var(--color-text-muted)',
              }}
            />
            projected on 23 May at current 14-day pace
          </div>
        </div>
      </section>

      {csat.level !== 'ok' && (
        <div className="sentinel-strip" role="status">
          <strong>CSAT Sentinel</strong>
          <span>
            {csat.daysSince} days without CSAT — your weekly insurance is{' '}
            {csat.level === 'alert' ? 'fraying. Even 30 minutes re-ropes it.' : 'due this week.'}
          </span>
          <button
            className="sentinel-action"
            onClick={() => setTimer({ block: 'csat', mode: 'study' })}
          >
            Start CSAT study
          </button>
        </div>
      )}

      <section className="stats-strip" aria-label="Key stats">
        <div
          className={`stat-cell ${todayMinutes >= todayTarget ? 'pace-ahead' : todayMinutes > 0 ? '' : 'pace-behind'}`}
        >
          <div className="stat-value num">
            {fmtHours(todayMinutes)} <em>/ {fmtHours(todayTarget)}</em>
          </div>
          <div className="stat-label micro">Today vs ramp target</div>
        </div>
        <div className="stat-cell">
          <div className="stat-value num">{currentStreak}</div>
          <div className="stat-label micro">Day streak</div>
        </div>
        <div className="stat-cell">
          <div className="stat-value num">{fmtHours(weekAvg)}</div>
          <div className="stat-label micro">7-day average / day</div>
        </div>
        <div className="stat-cell">
          <div className="stat-value num">{fmtHours(totalMinutes)}</div>
          <div className="stat-label micro">Total climbed</div>
        </div>
      </section>

      <RevisionQueue today={today} />

      <section className="cal-frame" ref={frameRef}>
        <div className="cal-toolbar">
          <nav className="crumbs" aria-label="Calendar level">
            <button
              className="crumb"
              aria-current={view.level === 'year'}
              onClick={() => collapseTo('year')}
            >
              {view.year}
            </button>
            {view.level !== 'year' && (
              <>
                <span className="crumb-sep">/</span>
                <button
                  className="crumb"
                  aria-current={view.level === 'month'}
                  onClick={() => collapseTo('month')}
                >
                  {MONTHS[view.month]}
                </button>
              </>
            )}
            {view.level === 'day' && (
              <>
                <span className="crumb-sep">/</span>
                <button className="crumb" aria-current="true">
                  {view.day.toString().padStart(2, '0')}
                </button>
              </>
            )}
          </nav>
          <div className="cal-nav">
            {view.level === 'year' && (
              <>
                <button className="icon-btn" onClick={() => setView((v) => ({ ...v, year: v.year - 1 }))} aria-label="Previous year">←</button>
                <button className="icon-btn" onClick={() => setView((v) => ({ ...v, year: v.year + 1 }))} aria-label="Next year">→</button>
              </>
            )}
            {view.level === 'month' && (
              <>
                <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">←</button>
                <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">→</button>
              </>
            )}
            {view.level === 'day' && (
              <>
                <button className="icon-btn" onClick={() => shiftDay(-1)} aria-label="Previous day">←</button>
                <button className="icon-btn" onClick={() => shiftDay(1)} aria-label="Next day">→</button>
              </>
            )}
          </div>
        </div>

        {view.level === 'year' && (
          <div className="view-zoom" key={`y${view.year}`}>
            <YearView
              year={view.year}
              logs={logs}
              targets={targets}
              today={today}
              onOpenMonth={openMonth}
            />
          </div>
        )}
        {view.level === 'month' && (
          <div className="view-zoom" key={`m${view.year}-${view.month}`}>
            <MonthView
              year={view.year}
              month={view.month}
              logs={logs}
              targets={targets}
              today={today}
              onOpenDay={openDay}
            />
          </div>
        )}
        {view.level === 'day' && (
          <div className="view-zoom" key={`d${selectedDayISO}`}>
            <DayView
              dateISO={selectedDayISO}
              logs={logs}
              targets={targets}
              today={today}
              onLogDelta={logDelta}
              onFocus={(b, m) => setTimer({ block: b, mode: m })}
            />
          </div>
        )}
      </section>

      <footer className="foot">
        <span className="micro">Ascent · five blocks a day, one mountain</span>
        <span className="micro num">
          Notification 13 Jan 2027 · Prelims 23 May 2027 · Mains 20 Aug 2027
        </span>
      </footer>

      {timer && (
        <FocusTimer
          key={`${timer.block}-${timer.mode}`}
          initialBlock={timer.block}
          mode={timer.mode}
          today={today}
          onClose={() => setTimer(null)}
          onLogged={creditSession}
        />
      )}

      <Soundscape />
    </div>
  );
}

function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-label="Ascent logo"
      className={className}
    >
      <rect x="1" y="1" width="30" height="30" stroke="currentColor" strokeWidth="2" />
      <path
        d="M6 24 L14 10 L19 17 L22 13 L27 24 Z"
        stroke="var(--color-accent)"
        strokeWidth="2.2"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
