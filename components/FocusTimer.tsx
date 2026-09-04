'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BLOCKS, BlockId } from '@/lib/blocks';

const WORK_MIN = 25;
const BREAK_MIN = 5;
const LONG_BREAK_MIN = 15;
const CYCLES = 4;

/** Focus (open-ended) mode: flush accrued minutes to the DB this often. */
const FLUSH_EVERY_MIN = 5;
/** Focus mode: gentle chime at every N minutes so you can track time by ear. */
const MILESTONE_MIN = 30;

export type TimerMode = 'study' | 'focus';

type Phase = 'idle' | 'work' | 'break' | 'longbreak';

interface Props {
  initialBlock: BlockId;
  mode: TimerMode;
  today: string;
  onClose: () => void;
  onLogged: (date: string, block: BlockId, minutes: number) => void;
}

/**
 * Distinct chimes so your ears know the transition without looking:
 * 'rest'      — descending two-tone (work done, put the pen down)
 * 'work'      — ascending three-tone (break over, back to the books)
 * 'milestone' — single soft tone (another half hour banked)
 */
function chime(kind: 'rest' | 'work' | 'milestone') {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes =
      kind === 'rest' ? [659.25, 493.88] : kind === 'work' ? [392, 523.25, 659.25] : [523.25];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.38;
      const peak = kind === 'milestone' ? 0.13 : 0.22;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  } catch {
    /* silent */
  }
}

const DIM_AFTER_MS = 8000;

function clockStr(totalSec: number, withHours: boolean): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (withHours && h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  const mm = withHours ? m : Math.floor(totalSec / 60);
  return `${mm}:${s.toString().padStart(2, '0')}`;
}

export default function FocusTimer({ initialBlock, mode, today, onClose, onLogged }: Props) {
  const isFocus = mode === 'focus';

  const [block, setBlock] = useState<BlockId>(initialBlock);
  const [phase, setPhase] = useState<Phase>('idle');
  const [remaining, setRemaining] = useState(WORK_MIN * 60);
  const [elapsed, setElapsed] = useState(0); // focus mode: seconds counted up
  const [running, setRunning] = useState(false);
  const [cyclesDone, setCyclesDone] = useState(0);
  const [dimmed, setDimmed] = useState(false);

  const startedAtRef = useRef<string | null>(null);
  const endAtRef = useRef<number>(0);
  const phaseRef = useRef<Phase>('idle');
  const dimTimerRef = useRef<number | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  /* focus-mode accounting */
  const baseSecRef = useRef(0); // seconds banked before the current run segment
  const segStartRef = useRef(0); // Date.now() when the current segment began
  const flushedMinRef = useRef(0); // whole minutes already written to the DB
  const milestoneRef = useRef(0); // last milestone chimed
  const blockRef = useRef<BlockId>(initialBlock);

  phaseRef.current = phase;
  blockRef.current = block;

  const blockDef = BLOCKS.find((b) => b.id === block)!;

  /* ---- face-down mode: auto-dim while running ---- */
  const scheduleDim = useCallback(() => {
    if (dimTimerRef.current !== null) window.clearTimeout(dimTimerRef.current);
    dimTimerRef.current = window.setTimeout(() => setDimmed(true), DIM_AFTER_MS);
  }, []);

  const wake = useCallback(() => {
    setDimmed(false);
    scheduleDim();
  }, [scheduleDim]);

  useEffect(() => {
    if (running) {
      scheduleDim();
    } else {
      if (dimTimerRef.current !== null) window.clearTimeout(dimTimerRef.current);
      setDimmed(false);
    }
    return () => {
      if (dimTimerRef.current !== null) window.clearTimeout(dimTimerRef.current);
    };
  }, [running, scheduleDim]);

  /* ---- keep the screen alive during a session ---- */
  useEffect(() => {
    const request = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> };
        };
        if (running && nav.wakeLock && document.visibilityState === 'visible') {
          wakeLockRef.current = await nav.wakeLock.request('screen');
        }
      } catch {
        /* unsupported — fine */
      }
    };
    if (running) {
      request();
      const onVis = () => {
        if (document.visibilityState === 'visible') request();
      };
      document.addEventListener('visibilitychange', onVis);
      return () => {
        document.removeEventListener('visibilitychange', onVis);
        wakeLockRef.current?.release().catch(() => undefined);
        wakeLockRef.current = null;
      };
    }
    return () => {
      wakeLockRef.current?.release().catch(() => undefined);
      wakeLockRef.current = null;
    };
  }, [running]);

  /* ---- study mode: record a completed interval as a session ---- */
  const logSession = useCallback(
    (minutes: number) => {
      if (minutes < 1) return;
      const startedAt = startedAtRef.current ?? new Date().toISOString();
      fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block,
          date: today,
          startedAt,
          endedAt: new Date().toISOString(),
          minutes,
        }),
      }).catch(() => undefined);
      onLogged(today, block, minutes);
    },
    [block, today, onLogged]
  );

  /**
   * Focus mode: credit whole minutes as they accrue via an atomic increment,
   * so closing the tab mid-lecture never loses banked time.
   */
  const flushMinutes = useCallback(
    (totalSec: number, force = false) => {
      const whole = Math.floor(totalSec / 60);
      const pending = whole - flushedMinRef.current;
      if (pending < 1 || (!force && pending < FLUSH_EVERY_MIN)) return;
      flushedMinRef.current = whole;
      const b = blockRef.current;
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, block: b, delta: pending }),
      }).catch(() => undefined);
      onLogged(today, b, pending);
    },
    [today, onLogged]
  );

  const startPhase = useCallback((next: Phase) => {
    const mins = next === 'work' ? WORK_MIN : next === 'break' ? BREAK_MIN : LONG_BREAK_MIN;
    setPhase(next);
    setRemaining(mins * 60);
    endAtRef.current = Date.now() + mins * 60000;
    setRunning(true);
    if (next === 'work') startedAtRef.current = new Date().toISOString();
  }, []);

  const startFocus = useCallback(() => {
    startedAtRef.current = new Date().toISOString();
    baseSecRef.current = 0;
    flushedMinRef.current = 0;
    milestoneRef.current = 0;
    segStartRef.current = Date.now();
    setElapsed(0);
    setPhase('work');
    setRunning(true);
  }, []);

  /* ---- tick ---- */
  useEffect(() => {
    if (!running) return;

    if (isFocus) {
      const id = setInterval(() => {
        const total = baseSecRef.current + Math.round((Date.now() - segStartRef.current) / 1000);
        setElapsed(total);
        flushMinutes(total);
        const mins = Math.floor(total / 60);
        if (mins > 0 && mins % MILESTONE_MIN === 0 && milestoneRef.current !== mins) {
          milestoneRef.current = mins;
          chime('milestone');
        }
      }, 500);
      return () => clearInterval(id);
    }

    const id = setInterval(() => {
      const left = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        chime(phaseRef.current === 'work' ? 'rest' : 'work');
        if (phaseRef.current === 'work') {
          logSession(WORK_MIN);
          setCyclesDone((c) => {
            const done = c + 1;
            startPhase(done % CYCLES === 0 ? 'longbreak' : 'break');
            return done;
          });
        } else {
          startPhase('work');
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, isFocus, logSession, startPhase, flushMinutes]);

  /* ---- tab title ---- */
  useEffect(() => {
    if (phase !== 'idle') {
      const label = isFocus ? blockDef.short : phase === 'work' ? blockDef.short : 'Break';
      const t = isFocus ? clockStr(elapsed, true) : clockStr(remaining, false);
      document.title = `${t} · ${label} — Ascent`;
    }
    return () => {
      document.title = 'Ascent — UPSC CSE 2027 Study Calendar';
    };
  }, [remaining, elapsed, phase, isFocus, blockDef.short]);

  /* ---- flush on unmount so nothing is lost ---- */
  useEffect(() => {
    if (!isFocus) return;
    return () => {
      const total = running
        ? baseSecRef.current + Math.round((Date.now() - segStartRef.current) / 1000)
        : baseSecRef.current;
      flushMinutes(total, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocus]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (dimmed) wake();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, dimmed, wake]);

  const pauseResume = () => {
    if (isFocus) {
      if (running) {
        baseSecRef.current += Math.round((Date.now() - segStartRef.current) / 1000);
        setRunning(false);
        flushMinutes(baseSecRef.current, true);
      } else {
        segStartRef.current = Date.now();
        setRunning(true);
      }
      return;
    }
    if (running) {
      setRunning(false);
    } else {
      endAtRef.current = Date.now() + remaining * 1000;
      setRunning(true);
    }
  };

  const endEarly = () => {
    if (isFocus) {
      const total = running
        ? baseSecRef.current + Math.round((Date.now() - segStartRef.current) / 1000)
        : baseSecRef.current;
      flushMinutes(total, true);
      const mins = Math.floor(total / 60);
      if (mins >= 1) {
        fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            block,
            date: today,
            startedAt: startedAtRef.current ?? new Date().toISOString(),
            endedAt: new Date().toISOString(),
            minutes: mins,
            note: 'focus',
            creditMinutes: false, // already credited progressively
          }),
        }).catch(() => undefined);
      }
      setRunning(false);
      onClose();
      return;
    }
    if (phase === 'work') {
      const elapsedSec = WORK_MIN * 60 - remaining;
      logSession(Math.floor(elapsedSec / 60));
    }
    onClose();
  };

  /* ---- dial geometry ---- */
  const R = 118;
  const CIRC = 2 * Math.PI * R;
  const studyTotal =
    phase === 'break' ? BREAK_MIN * 60 : phase === 'longbreak' ? LONG_BREAK_MIN * 60 : WORK_MIN * 60;
  // Focus mode: the ring sweeps once per hour, so each lap = one hour banked.
  const frac = isFocus ? (elapsed % 3600) / 3600 : 1 - remaining / studyTotal;
  const timeStr = isFocus ? clockStr(elapsed, true) : clockStr(remaining, false);

  const phaseLabel = isFocus
    ? phase === 'idle'
      ? 'Ready'
      : running
        ? 'Focus · running'
        : 'Focus · paused'
    : phase === 'idle'
      ? 'Ready'
      : phase === 'work'
        ? 'Deep work'
        : phase === 'break'
          ? 'Short break'
          : 'Long break';

  const dialColor =
    isFocus || phase === 'work' || phase === 'idle'
      ? `var(${blockDef.colorVar})`
      : 'var(--color-text-muted)';

  const bankedMin = Math.floor(elapsed / 60);
  const lapsDone = Math.floor(elapsed / 3600);

  return (
    <div
      className="timer-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={isFocus ? 'Focus timer (open-ended)' : 'Study timer (Pomodoro)'}
    >
      <div className="timer-card">
        <div className="timer-mode-tag micro">
          {isFocus ? 'Focus · open-ended' : 'Study · Pomodoro 25/5'}
        </div>

        <div className="timer-block-row">
          {BLOCKS.map((b) => (
            <button
              key={b.id}
              className="timer-block-chip"
              style={{ ['--chip-color' as string]: `var(${b.colorVar})` }}
              aria-pressed={b.id === block}
              disabled={phase !== 'idle' && running}
              onClick={() => setBlock(b.id)}
            >
              {b.short}
            </button>
          ))}
        </div>

        <div className={`timer-dial${isFocus ? ' focus-dial' : ''}`}>
          <svg width="100%" height="100%" viewBox="0 0 260 260">
            <circle cx="130" cy="130" r={R} fill="none" stroke="var(--color-divider)" strokeWidth="6" />
            <circle
              cx="130"
              cy="130"
              r={R}
              fill="none"
              stroke={dialColor}
              strokeWidth="6"
              strokeLinecap="butt"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - frac)}
              style={{ transition: 'stroke-dashoffset 300ms linear' }}
            />
          </svg>
          <div className="timer-readout">
            <div className={`timer-time${isFocus && elapsed >= 3600 ? ' long' : ''}`}>{timeStr}</div>
            <div className="timer-phase">{phaseLabel}</div>
          </div>
        </div>

        {isFocus ? (
          <div className="focus-meta">
            <span className="num">{bankedMin} min banked</span>
            <span className="focus-meta-sep">·</span>
            <span className="num">
              {lapsDone} {lapsDone === 1 ? 'hour' : 'hours'} complete
            </span>
          </div>
        ) : (
          <div className="cycle-dots" aria-label={`${cyclesDone % CYCLES} of ${CYCLES} pomodoros in this set`}>
            {Array.from({ length: CYCLES }, (_, i) => (
              <span
                key={i}
                className={`cycle-dot${i < (cyclesDone % CYCLES === 0 && cyclesDone > 0 ? CYCLES : cyclesDone % CYCLES) ? ' done' : ''}`}
              />
            ))}
          </div>
        )}

        <div className="timer-actions">
          {phase === 'idle' ? (
            <button className="timer-btn primary" onClick={isFocus ? startFocus : () => startPhase('work')}>
              {isFocus ? 'Start focus' : 'Start 25:00'}
            </button>
          ) : (
            <>
              <button className="timer-btn" onClick={pauseResume}>
                {running ? 'Pause' : 'Resume'}
              </button>
              <button className="timer-btn primary" onClick={endEarly}>
                End &amp; log
              </button>
            </>
          )}
          <button className="timer-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="timer-note">
          {isFocus ? (
            <>
              Runs open-ended for lectures and long sittings — no breaks, no limit. Minutes are
              banked to {blockDef.label} every {FLUSH_EVERY_MIN} minutes, so nothing is lost if you
              close the tab. A soft chime marks each {MILESTONE_MIN} minutes; the ring completes one
              lap per hour. The screen dims to near-black while running — tap to wake.
            </>
          ) : (
            <>
              25 min work · 5 min break · every 4th break is 15 min. Completed work intervals are
              logged to {blockDef.label} automatically. While running, the screen dims to near-black
              after a few seconds — tap to wake. Chimes differ: falling tones mean rest, rising tones
              mean back to work.
            </>
          )}
        </p>
      </div>

      {dimmed && (
        <button className="dim-screen" onClick={wake} aria-label="Screen dimmed — tap to wake">
          <span
            className="dim-dot"
            style={{
              background:
                isFocus || phase === 'work' ? `var(${blockDef.colorVar})` : 'var(--color-text-muted)',
            }}
          />
          <span className="dim-time num">{timeStr}</span>
          <span className="dim-phase">{phaseLabel}</span>
          <span className="dim-hint">tap to wake</span>
        </button>
      )}
    </div>
  );
}
