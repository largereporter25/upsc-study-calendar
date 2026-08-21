'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BLOCKS, BlockId } from '@/lib/blocks';

const WORK_MIN = 25;
const BREAK_MIN = 5;
const LONG_BREAK_MIN = 15;
const CYCLES = 4;

type Phase = 'idle' | 'work' | 'break' | 'longbreak';

interface Props {
  initialBlock: BlockId;
  today: string;
  onClose: () => void;
  onLogged: (date: string, block: BlockId, minutes: number) => void;
}

function beep(times = 2) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 660;
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.35;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.32);
    }
  } catch {
    /* silent */
  }
}

export default function FocusTimer({ initialBlock, today, onClose, onLogged }: Props) {
  const [block, setBlock] = useState<BlockId>(initialBlock);
  const [phase, setPhase] = useState<Phase>('idle');
  const [remaining, setRemaining] = useState(WORK_MIN * 60);
  const [running, setRunning] = useState(false);
  const [cyclesDone, setCyclesDone] = useState(0);
  const startedAtRef = useRef<string | null>(null);
  const endAtRef = useRef<number>(0);
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;

  const blockDef = BLOCKS.find((b) => b.id === block)!;

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

  const startPhase = useCallback((next: Phase) => {
    const mins = next === 'work' ? WORK_MIN : next === 'break' ? BREAK_MIN : LONG_BREAK_MIN;
    setPhase(next);
    setRemaining(mins * 60);
    endAtRef.current = Date.now() + mins * 60000;
    setRunning(true);
    if (next === 'work') startedAtRef.current = new Date().toISOString();
  }, []);

  /* tick */
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        beep(phaseRef.current === 'work' ? 2 : 1);
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
  }, [running, logSession, startPhase]);

  /* title + escape key */
  useEffect(() => {
    const mm = Math.floor(remaining / 60);
    const ss = remaining % 60;
    if (phase !== 'idle') {
      document.title = `${mm}:${ss.toString().padStart(2, '0')} · ${
        phase === 'work' ? blockDef.short : 'Break'
      } — Ascent`;
    }
    return () => {
      document.title = 'Ascent — UPSC CSE 2027 Study Calendar';
    };
  }, [remaining, phase, blockDef.short]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pauseResume = () => {
    if (running) {
      setRunning(false);
    } else {
      endAtRef.current = Date.now() + remaining * 1000;
      setRunning(true);
    }
  };

  const endEarly = () => {
    if (phase === 'work') {
      const elapsedSec = WORK_MIN * 60 - remaining;
      logSession(Math.floor(elapsedSec / 60));
    }
    onClose();
  };

  const totalSec =
    phase === 'break' ? BREAK_MIN * 60 : phase === 'longbreak' ? LONG_BREAK_MIN * 60 : WORK_MIN * 60;
  const frac = 1 - remaining / totalSec;
  const R = 118;
  const CIRC = 2 * Math.PI * R;
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;

  const phaseLabel =
    phase === 'idle'
      ? 'Ready'
      : phase === 'work'
        ? 'Deep work'
        : phase === 'break'
          ? 'Short break'
          : 'Long break';

  const dialColor =
    phase === 'work' || phase === 'idle' ? `var(${blockDef.colorVar})` : 'var(--color-text-muted)';

  return (
    <div className="timer-overlay" role="dialog" aria-modal="true" aria-label="Focus timer">
      <div className="timer-card">
        <div className="timer-block-row">
          {BLOCKS.map((b) => (
            <button
              key={b.id}
              className="timer-block-chip"
              style={{ ['--chip-color' as string]: `var(${b.colorVar})` }}
              aria-pressed={b.id === block}
              disabled={phase === 'work' && running}
              onClick={() => setBlock(b.id)}
            >
              {b.short}
            </button>
          ))}
        </div>

        <div className="timer-dial">
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
            <div className="timer-time">
              {mm}:{ss.toString().padStart(2, '0')}
            </div>
            <div className="timer-phase">{phaseLabel}</div>
          </div>
        </div>

        <div className="cycle-dots" aria-label={`${cyclesDone % CYCLES} of ${CYCLES} pomodoros in this set`}>
          {Array.from({ length: CYCLES }, (_, i) => (
            <span
              key={i}
              className={`cycle-dot${i < (cyclesDone % CYCLES === 0 && cyclesDone > 0 ? CYCLES : cyclesDone % CYCLES) ? ' done' : ''}`}
            />
          ))}
        </div>

        <div className="timer-actions">
          {phase === 'idle' ? (
            <button className="timer-btn primary" onClick={() => startPhase('work')}>
              Start 25:00
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
          25 min work · 5 min break · every 4th break is 15 min. Completed work intervals are
          logged to {blockDef.label} automatically.
        </p>
      </div>
    </div>
  );
}
