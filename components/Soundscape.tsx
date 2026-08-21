'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Soundscape dock — Indian classical instrumental focus stations.
 * YouTube stations stream long raga sessions; the Tanpura Drone and
 * Monsoon Rain stations are synthesized locally with WebAudio (no
 * network, no copyright, endless).
 */

interface YtStation {
  kind: 'yt';
  id: string;
  videoId: string;
  label: string;
  detail: string;
}

interface SynthStation {
  kind: 'synth';
  id: 'tanpura' | 'rain';
  label: string;
  detail: string;
}

type Station = YtStation | SynthStation;

const STATIONS: Station[] = [
  { kind: 'yt', id: 'sitar', videoId: 'R1RmNzjoLoU', label: 'Sitar', detail: 'Deep focus · 2 h' },
  { kind: 'yt', id: 'bansuri', videoId: 'zgnpPGddxPk', label: 'Bansuri', detail: 'Flute meditation · 6 h' },
  { kind: 'yt', id: 'santoor', videoId: '0PLbxaO8SLQ', label: 'Santoor', detail: 'Saaz · Pt. Shivkumar Sharma · 1 h' },
  { kind: 'yt', id: 'raga', videoId: 'qUX98jdPXtY', label: 'Raga Focus', detail: 'Concentration ragas · 3 h' },
  { kind: 'yt', id: 'marathon', videoId: 'gJzLdCEnFKI', label: 'Marathon', detail: 'Non-stop instrumental · 10 h' },
  { kind: 'synth', id: 'tanpura', label: 'Tanpura Drone', detail: 'Synthesized · endless' },
  { kind: 'synth', id: 'rain', label: 'Monsoon Rain', detail: 'Synthesized · endless' },
];

export default function Soundscape() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [volume, setVolume] = useState(0.5);

  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const schedulerRef = useRef<number | null>(null);
  const nextPluckRef = useRef(0);

  const station = STATIONS.find((s) => s.id === active) ?? null;

  const stopSynth = () => {
    if (schedulerRef.current !== null) {
      window.clearInterval(schedulerRef.current);
      schedulerRef.current = null;
    }
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => undefined);
      ctxRef.current = null;
      masterRef.current = null;
    }
  };

  const startTanpura = () => {
    stopSynth();
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = volume * 0.5;
    master.connect(ctx.destination);
    ctxRef.current = ctx;
    masterRef.current = master;

    // Pa (low) – Sa – Sa – Sa (low octave), C# tuning
    const STRINGS = [103.83, 138.59, 138.59, 69.3];
    const CYCLE = 4.4;
    nextPluckRef.current = ctx.currentTime + 0.1;

    const pluck = (t: number, freq: number) => {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = 'sawtooth';
      o2.type = 'sawtooth';
      o1.frequency.value = freq;
      o2.frequency.value = freq * 1.003; // jawari shimmer
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(freq * 6, t);
      bp.frequency.exponentialRampToValueAtTime(freq * 2, t + 2.5);
      bp.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.8);
      o1.connect(bp);
      o2.connect(bp);
      bp.connect(g);
      g.connect(master);
      o1.start(t);
      o2.start(t);
      o1.stop(t + 4);
      o2.stop(t + 4);
    };

    schedulerRef.current = window.setInterval(() => {
      if (!ctxRef.current) return;
      while (nextPluckRef.current < ctx.currentTime + 1.2) {
        const cycleStart = nextPluckRef.current;
        STRINGS.forEach((f, i) => pluck(cycleStart + i * (CYCLE / 4), f));
        nextPluckRef.current = cycleStart + CYCLE;
      }
    }, 400);
  };

  const startRain = () => {
    stopSynth();
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = volume * 0.7;
    master.connect(ctx.destination);
    ctxRef.current = ctx;
    masterRef.current = master;

    const seconds = 4;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 850;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain);
    lfoGain.connect(lp.frequency);
    src.connect(lp);
    lp.connect(master);
    src.start();
    lfo.start();
  };

  const select = (s: Station) => {
    if (active === s.id) {
      // toggle off
      setActive(null);
      setVideoOpen(false);
      stopSynth();
      return;
    }
    setActive(s.id);
    setVideoOpen(false);
    if (s.kind === 'synth') {
      if (s.id === 'tanpura') startTanpura();
      else startRain();
    } else {
      stopSynth();
    }
  };

  useEffect(() => {
    if (masterRef.current && ctxRef.current) {
      const scale = active === 'rain' ? 0.7 : 0.5;
      masterRef.current.gain.setTargetAtTime(volume * scale, ctxRef.current.currentTime, 0.05);
    }
  }, [volume, active]);

  useEffect(() => stopSynth, []);

  return (
    <div className={`sound-dock${open ? ' open' : ''}`}>
      {/* The card stays mounted so the stream keeps playing when minimised. */}
      <div className={`sound-card${open ? '' : ' is-hidden'}`}>
        <div className="sound-head">
          <span className="micro">Soundscape · Indian Classical</span>
          <button className="sound-min" onClick={() => setOpen(false)} aria-label="Minimise soundscape (music keeps playing)">
            —
          </button>
        </div>
        <div className="sound-stations">
          {STATIONS.map((s) => (
            <button
              key={s.id}
              className="sound-chip"
              aria-pressed={active === s.id}
              onClick={() => select(s)}
              title={s.detail}
            >
              <strong>{s.label}</strong>
              <span>{s.detail}</span>
            </button>
          ))}
        </div>
        {station?.kind === 'yt' && (
          <div className="sound-player">
            <div className="sound-now">
              <span className="sound-eq" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="sound-now-label">
                {station.label} · {station.detail}
              </span>
              <button className="sound-video-toggle" onClick={() => setVideoOpen((v) => !v)}>
                {videoOpen ? 'Hide video' : 'Show video'}
              </button>
            </div>
            <iframe
              key={station.videoId}
              className={`sound-frame${videoOpen ? '' : ' collapsed'}`}
              src={`https://www.youtube-nocookie.com/embed/${station.videoId}?autoplay=1&rel=0`}
              title={`${station.label} — ${station.detail}`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        {station?.kind === 'synth' && (
          <div className="sound-synth">
            <span className="micro">{station.label} playing</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
            />
          </div>
        )}
      </div>
      <button
        className={`sound-toggle${active ? ' live' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Minimise soundscape' : 'Open soundscape'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 10v4" />
          <path d="M8 6v12" />
          <path d="M12 3v18" />
          <path d="M16 7v10" />
          <path d="M20 10v4" />
        </svg>
      </button>
    </div>
  );
}
