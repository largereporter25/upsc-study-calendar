'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Focus Player — long instrumental stations grouped by genre.
 * YouTube stations stream long sessions; Tanpura Drone and Monsoon Rain
 * are synthesized locally with WebAudio (no network, endless).
 */

interface YtStation {
  kind: 'yt';
  id: string;
  videoId: string;
  label: string;
  hours: number;
}

interface SynthStation {
  kind: 'synth';
  id: 'tanpura' | 'rain';
  label: string;
  hours: null;
}

type Station = YtStation | SynthStation;

interface Group {
  name: string;
  stations: Station[];
}

const GROUPS: Group[] = [
  {
    name: 'Indian Classical',
    stations: [
      { kind: 'yt', id: 'sitar', videoId: 'R1RmNzjoLoU', label: 'Sitar · Deep Focus', hours: 2 },
      { kind: 'yt', id: 'bansuri', videoId: 'zgnpPGddxPk', label: 'Bansuri · Meditation', hours: 6 },
      { kind: 'yt', id: 'santoor', videoId: '0PLbxaO8SLQ', label: 'Santoor · Pt. Shivkumar Sharma', hours: 1 },
      { kind: 'yt', id: 'raga', videoId: 'qUX98jdPXtY', label: 'Raga Focus Therapy', hours: 3 },
      { kind: 'yt', id: 'marathon', videoId: 'gJzLdCEnFKI', label: 'Instrumental Marathon', hours: 10 },
    ],
  },
  {
    name: 'Fusion',
    stations: [
      { kind: 'yt', id: 'indojazz', videoId: 'X7yImR4pbKQ', label: 'Indo-Jazz · Kolkata to the Ganges', hours: 1.5 },
      { kind: 'yt', id: 'sitartronic', videoId: 'hz6RAZuy3uY', label: 'Sitar × Electronic Ambient', hours: 1 },
      { kind: 'yt', id: 'carnatic', videoId: '0PtG7gXRhyw', label: 'Carnatic Fusion · Violin & Veena', hours: 1 },
      { kind: 'yt', id: 'worldflute', videoId: 'HJK0Gi2EXN8', label: 'Bansuri World Fusion', hours: 1 },
    ],
  },
  {
    name: 'Jazz',
    stations: [
      { kind: 'yt', id: 'smoothjazz', videoId: 'FjONg1zA2WU', label: 'Smooth Jazz · Deep Focus', hours: 3 },
      { kind: 'yt', id: 'pianotrio', videoId: 'vFoHuL359F4', label: 'Jazz Piano Trio', hours: 2 },
      { kind: 'yt', id: 'bossa', videoId: 'kt5WVfpuxss', label: 'Bossa Nova · 50 Êxitos', hours: 2.75 },
    ],
  },
  {
    name: 'More',
    stations: [
      { kind: 'yt', id: 'piano', videoId: 'y52M4maVe4w', label: 'Classical Piano · Chopin & Debussy', hours: 2 },
      { kind: 'yt', id: 'drone', videoId: '_pemrhkgm08', label: 'Ambient Drone · Eno-style', hours: 2 },
      { kind: 'yt', id: 'binaural', videoId: 'NGR-rucUhys', label: '40 Hz Gamma · Binaural', hours: 3 },
      { kind: 'yt', id: 'filmscore', videoId: 'ma56LStEOdM', label: 'Film Score · Epic Strings', hours: 1 },
    ],
  },
  {
    name: 'Synthesized',
    stations: [
      { kind: 'synth', id: 'tanpura', label: 'Tanpura Drone', hours: null },
      { kind: 'synth', id: 'rain', label: 'Monsoon Rain', hours: null },
    ],
  },
];

const ALL_STATIONS: Station[] = GROUPS.flatMap((g) => g.stations);
const TOTAL_HOURS = Math.round(
  ALL_STATIONS.reduce((s, st) => s + (st.hours ?? 0), 0)
);

function fmtLen(hours: number | null): string {
  if (hours === null) return '∞';
  if (Number.isInteger(hours)) return `${hours} h`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return h > 0 ? `${h} h ${m.toString().padStart(2, '0')}` : `${m} m`;
}

export default function Soundscape() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [volume, setVolume] = useState(0.5);

  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const schedulerRef = useRef<number | null>(null);
  const nextPluckRef = useRef(0);

  const station = ALL_STATIONS.find((s) => s.id === active) ?? null;

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

    const STRINGS = [103.83, 138.59, 138.59, 69.3];
    const CYCLE = 4.4;
    nextPluckRef.current = ctx.currentTime + 0.1;

    const pluck = (t: number, freq: number) => {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = 'sawtooth';
      o2.type = 'sawtooth';
      o1.frequency.value = freq;
      o2.frequency.value = freq * 1.003;
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
          <div>
            <span className="sound-title">Focus Player</span>
            <span className="sound-sub num">{TOTAL_HOURS}+ hours · {ALL_STATIONS.length} stations</span>
          </div>
          <button className="sound-min" onClick={() => setOpen(false)} aria-label="Minimise player (music keeps playing)">
            —
          </button>
        </div>

        <div className="sound-groups">
          {GROUPS.map((g) => (
            <div className="sound-group" key={g.name}>
              <div className="sound-group-name micro">{g.name}</div>
              {g.stations.map((s) => (
                <button
                  key={s.id}
                  className="sound-row"
                  aria-pressed={active === s.id}
                  onClick={() => select(s)}
                >
                  <span className="sound-row-state" aria-hidden="true">
                    {active === s.id ? (
                      <span className="sound-eq">
                        <i />
                        <i />
                        <i />
                      </span>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M2 1.5 L8.5 5 L2 8.5 Z" />
                      </svg>
                    )}
                  </span>
                  <span className="sound-row-label">{s.label}</span>
                  <span className="sound-row-len num">{fmtLen(s.hours)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {station?.kind === 'yt' && (
          <div className="sound-player">
            <div className="sound-now">
              <span className="sound-now-label">{station.label}</span>
              <button className="sound-video-toggle" onClick={() => setVideoOpen((v) => !v)}>
                {videoOpen ? 'Hide video' : 'Show video'}
              </button>
              <button className="sound-video-toggle" onClick={() => select(station)}>
                Stop
              </button>
            </div>
            <iframe
              key={station.videoId}
              className={`sound-frame${videoOpen ? '' : ' collapsed'}`}
              src={`https://www.youtube-nocookie.com/embed/${station.videoId}?autoplay=1&rel=0`}
              title={station.label}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        {station?.kind === 'synth' && (
          <div className="sound-player">
            <div className="sound-now">
              <span className="sound-now-label">{station.label}</span>
              <button className="sound-video-toggle" onClick={() => select(station)}>
                Stop
              </button>
            </div>
            <div className="sound-synth">
              <span className="micro">Volume</span>
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
          </div>
        )}
      </div>

      <button
        className={`sound-toggle${active ? ' live' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Minimise focus player' : 'Open focus player'}
      >
        {active ? (
          <span className="sound-eq big" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5.5 L19 12 L8 18.5 Z" />
          </svg>
        )}
      </button>
    </div>
  );
}
