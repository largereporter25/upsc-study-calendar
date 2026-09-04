'use client';

import { BLOCKS, BlockId, JOURNEY_START } from '@/lib/blocks';
import { Sentinel, Weather, blockFraction } from '@/lib/stats';

/**
 * The Ascent — five climbers roped together on one mountain.
 * X-progress = share of the block's total required hours (start → Prelims).
 * Hollow markers = projected position on Prelims day at the current 14-day pace.
 * The sky reacts to the last week of work; the CSAT rope frays when neglected.
 */

const W = 1000;
const H = 340;
const BASE_Y = 296;

const ROUTE: [number, number][] = [
  [52, BASE_Y],
  [160, 268],
  [258, 232],
  [340, 244],
  [438, 196],
  [532, 156],
  [608, 170],
  [700, 118],
  [796, 84],
  [900, 44],
];

function routeLengths() {
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < ROUTE.length; i++) {
    const dx = ROUTE[i][0] - ROUTE[i - 1][0];
    const dy = ROUTE[i][1] - ROUTE[i - 1][1];
    const l = Math.hypot(dx, dy);
    lens.push(l);
    total += l;
  }
  return { lens, total };
}

const { lens: SEG_LENS, total: TOTAL_LEN } = routeLengths();

function pointAt(fraction: number): [number, number] {
  const f = Math.max(0, Math.min(1, fraction));
  let dist = f * TOTAL_LEN;
  for (let i = 0; i < SEG_LENS.length; i++) {
    if (dist <= SEG_LENS[i]) {
      const t = SEG_LENS[i] === 0 ? 0 : dist / SEG_LENS[i];
      const [x1, y1] = ROUTE[i];
      const [x2, y2] = ROUTE[i + 1];
      return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
    }
    dist -= SEG_LENS[i];
  }
  return ROUTE[ROUTE.length - 1];
}

/** Snow begins here (SVG y, smaller = higher). */
const SNOWLINE = 154;

/** Distant ranges for atmospheric depth, drawn behind the massif. */
const FAR_RANGE =
  '30,300 84,246 132,266 186,214 232,242 292,200 352,230 410,192 470,222 528,238 590,258 654,244 716,264 790,252 872,266 970,300';
const MID_RANGE =
  '30,300 104,258 158,276 226,232 288,258 348,238 408,262 468,248 528,266 596,280 668,272 744,282 830,274 970,300';

/** Irregular snowline: a jagged boundary reads as wind-scoured snow. */
const SNOW_JAG: [number, number][] = [
  [30, SNOWLINE + 16],
  [96, SNOWLINE + 6],
  [150, SNOWLINE + 18],
  [214, SNOWLINE + 2],
  [268, SNOWLINE + 14],
  [330, SNOWLINE - 4],
  [392, SNOWLINE + 10],
  [452, SNOWLINE - 2],
  [514, SNOWLINE + 12],
  [576, SNOWLINE - 6],
  [640, SNOWLINE + 8],
  [704, SNOWLINE - 10],
  [768, SNOWLINE + 4],
  [832, SNOWLINE - 12],
  [900, SNOWLINE - 2],
  [970, SNOWLINE + 6],
];

const CAMPS: { f: number; label: string }[] = [
  { f: 0.25, label: 'CAMP I' },
  { f: 0.5, label: 'CAMP II' },
  { f: 0.75, label: 'CAMP III' },
];

const BASE_LABEL = `BASE · ${new Date(JOURNEY_START + 'T00:00:00')
  .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  .toUpperCase()
  .replace(/,/g, '')}`;

/* ---------- weather glyphs ---------- */

function Cloud({ x, y, s = 1, tone, drift }: { x: number; y: number; s?: number; tone: string; drift?: boolean }) {
  return (
    <g className={drift ? 'wx-drift' : undefined} style={{ ['--wx-x' as string]: `${x}px` }}>
      <g transform={`translate(${x} ${y}) scale(${s})`} fill={tone}>
        <ellipse cx="0" cy="0" rx="26" ry="11" />
        <ellipse cx="-14" cy="-7" rx="14" ry="9" />
        <ellipse cx="12" cy="-6" rx="12" ry="8" />
      </g>
    </g>
  );
}

function Sky({ weather }: { weather: Weather }) {
  const k = weather.kind;
  if (k === 'radiant' || k === 'clear') {
    const r = k === 'radiant' ? 15 : 10;
    return (
      <g>
        <circle cx={140} cy={84} r={r} fill="none" stroke="var(--c-gs-dynamic)" strokeWidth="2" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          const r1 = r + 6;
          const r2 = r + (k === 'radiant' ? 14 : 10);
          return (
            <line
              key={i}
              x1={140 + Math.cos(a) * r1}
              y1={84 + Math.sin(a) * r1}
              x2={140 + Math.cos(a) * r2}
              y2={84 + Math.sin(a) * r2}
              stroke="var(--c-gs-dynamic)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}
        {k === 'radiant' && (
          <circle cx={140} cy={84} r={26} fill="none" stroke="var(--c-gs-dynamic)" strokeWidth="1" strokeDasharray="2 5" opacity="0.6" />
        )}
      </g>
    );
  }
  if (k === 'clouds') {
    return (
      <g opacity="0.8">
        <Cloud x={150} y={84} tone="var(--color-text-faint)" drift />
        <Cloud x={250} y={64} s={0.7} tone="var(--color-text-faint)" />
      </g>
    );
  }
  if (k === 'overcast') {
    return (
      <g opacity="0.9">
        <Cloud x={140} y={78} s={1.1} tone="var(--color-text-faint)" drift />
        <Cloud x={252} y={60} s={0.8} tone="var(--color-text-faint)" />
        <Cloud x={356} y={86} s={0.9} tone="var(--color-text-faint)" drift />
        <line x1={92} y1={112} x2={300} y2={112} stroke="var(--color-text-faint)" strokeWidth="1.5" opacity="0.5" />
        <line x1={140} y1={122} x2={392} y2={122} stroke="var(--color-text-faint)" strokeWidth="1.5" opacity="0.35" />
      </g>
    );
  }
  // storm
  return (
    <g>
      <Cloud x={160} y={72} s={1.2} tone="var(--color-text-muted)" drift />
      <Cloud x={280} y={58} s={0.9} tone="var(--color-text-muted)" />
      {Array.from({ length: 7 }, (_, i) => (
        <line
          key={i}
          className="wx-rain"
          x1={118 + i * 30}
          y1={96}
          x2={110 + i * 30}
          y2={118}
          stroke="var(--c-gs-static)"
          strokeWidth="1.6"
          strokeLinecap="round"
          style={{ animationDelay: `${(i % 3) * 0.4}s` }}
        />
      ))}
      <polygon
        points="238,80 226,104 236,104 222,132 246,102 236,102 250,80"
        fill="var(--color-accent)"
        className="wx-flash"
      />
    </g>
  );
}

/* ---------- component ---------- */

interface Props {
  cumulative: Record<BlockId, number>;
  targets: Record<BlockId, number>;
  pace: number;
  weather: Weather;
  projections: Record<BlockId, number>;
  csat: Sentinel;
}

/** Sparse gullies falling from ridge vertices — suggests relief without stripes. */
const GULLIES = ROUTE.slice(1, -1)
  .filter((_, i) => i % 2 === 0)
  .map(([x, y]) => {
    const drop = Math.min(BASE_Y - 6, y + 92);
    return `M ${x},${y + 6} C ${x + 8},${y + 34} ${x - 6},${(y + drop) / 2} ${x + 4},${drop}`;
  });

export default function Ascent({ cumulative, targets, pace, weather, projections, csat }: Props) {
  const routeStr = ROUTE.map((p) => p.join(',')).join(' ');
  const silhouette = `${routeStr} ${ROUTE[ROUTE.length - 1][0]},${BASE_Y} 52,${BASE_Y}`;
  const snowPath = `M 30,4 L 30,${SNOW_JAG[0][1]} ${SNOW_JAG.map((p) => `L ${p[0]},${p[1]}`).join(' ')} L 970,4 Z`;
  const snowEdge = `M ${SNOW_JAG.map((p) => `${p[0]},${p[1]}`).join(' L ')}`;
  const crestBand = `M ${ROUTE.map((p) => `${p[0]},${p[1]}`).join(' L ')} L ${[...ROUTE]
    .reverse()
    .map((p) => `${p[0]},${p[1] + 17}`)
    .join(' L ')} Z`;

  const climbers = BLOCKS.map((b) => ({
    block: b,
    f: blockFraction(cumulative, targets, b.id),
  })).sort((a, b) => a.f - b.f);

  const placed = climbers.map((c, i) => {
    const [x, y] = pointAt(c.f);
    let bump = 0;
    for (let j = 0; j < i; j++) {
      if (Math.abs(climbers[j].f - c.f) < 0.022) bump += 1;
    }
    return { ...c, x: x + bump * 4, y: y - bump * 13 };
  });

  const ropeStr = placed.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const [paceX, paceY] = pointAt(pace);
  const summit = ROUTE[ROUTE.length - 1];
  const csatClimber = placed.find((c) => c.block.id === 'csat');

  return (
    <svg
      className="ascent-svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Mountain chart of study progress toward Prelims 2027. Weather: ${weather.label}. Hollow markers show projected positions at the current pace.`}
    >
      {/* precision grid */}
      {Array.from({ length: 9 }, (_, i) => {
        const x = 52 + ((900 - 52) * (i + 1)) / 10;
        return (
          <line key={i} x1={x} y1={40} x2={x} y2={BASE_Y} stroke="var(--color-divider)" strokeWidth="1" />
        );
      })}

      {/* weather */}
      <Sky weather={weather} />
      <text x={52} y={54} fontSize="10" fontWeight="700" letterSpacing="1.2" fill="var(--color-text-muted)">
        {weather.label.toUpperCase()}
      </text>

      {/* ---------- mountain artwork ---------- */}
      <defs>
        <clipPath id="massif-clip">
          <polygon points={silhouette} />
        </clipPath>
        <linearGradient id="rock-face" x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor="var(--mtn-lit)" />
          <stop offset="55%" stopColor="var(--mtn-lit)" />
          <stop offset="100%" stopColor="var(--mtn-shadow)" />
        </linearGradient>
        <linearGradient id="valley-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-bg)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--color-bg)" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* distant range — atmospheric perspective */}
      <polygon points={FAR_RANGE} fill="var(--mtn-far)" />

      {/* the massif */}
      <g clipPath="url(#massif-clip)">
        <polygon points={silhouette} fill="url(#rock-face)" />

        {/* snowfield above the wind-scoured snowline */}
        <path d={snowPath} fill="var(--mtn-snow)" />
        <path d={snowEdge} fill="none" stroke="var(--mtn-snow-shade)" strokeWidth="1.6" />

        {/* glacier seams */}
        <path
          d="M 560,152 C 620,130 664,144 706,114"
          fill="none"
          stroke="var(--mtn-snow-shade)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M 730,108 C 784,92 830,72 888,50"
          fill="none"
          stroke="var(--mtn-snow-shade)"
          strokeWidth="1.3"
          strokeLinecap="round"
        />

        {/* sunlit crest band just under the ridge */}
        <path d={crestBand} fill="var(--mtn-crest)" opacity="0.9" />

        {/* valley haze softens the base */}
        <rect x="30" y={BASE_Y - 54} width="940" height="54" fill="url(#valley-haze)" />
      </g>

      {/* the ridge itself */}
      <polyline
        points={routeStr}
        fill="none"
        stroke="var(--mtn-ridge)"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* baseline */}
      <line x1={40} y1={BASE_Y} x2={960} y2={BASE_Y} stroke="var(--color-text)" strokeWidth="1.5" />

      {/* camps */}
      {CAMPS.map((c) => {
        const [x, y] = pointAt(c.f);
        return (
          <g key={c.label}>
            <line x1={x} y1={y} x2={x} y2={y - 12} stroke="var(--color-text-faint)" strokeWidth="1.5" />
            <text x={x} y={y - 18} textAnchor="middle" fontSize="10" fontWeight="600" letterSpacing="1" fill="var(--color-text-faint)">
              {c.label}
            </text>
          </g>
        );
      })}

      {/* base camp */}
      <text x={52} y={BASE_Y + 36} fontSize="10" fontWeight="600" letterSpacing="1" fill="var(--color-text-muted)">
        {BASE_LABEL}
      </text>

      {/* summit flag */}
      <g>
        <line x1={summit[0]} y1={summit[1]} x2={summit[0]} y2={summit[1] - 26} stroke="var(--color-text)" strokeWidth="2" />
        <path d={`M ${summit[0]} ${summit[1] - 26} l 20 5 l -20 5 Z`} fill="var(--color-accent)" />
        <text x={summit[0] + 6} y={summit[1] + 16} fontSize="11" fontWeight="700" letterSpacing="1" fill="var(--color-text)">
          AIR 1
        </text>
        <text x={summit[0] + 6} y={summit[1] + 30} fontSize="9.5" fontWeight="600" letterSpacing="0.5" fill="var(--color-text-muted)">
          23 MAY 2027
        </text>
      </g>

      {/* pace marker */}
      <g>
        <line x1={paceX} y1={paceY} x2={paceX} y2={BASE_Y} stroke="var(--color-accent)" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.7" />
        <circle cx={paceX} cy={paceY} r="8" fill="none" stroke="var(--color-accent)" strokeWidth="1.6" strokeDasharray="2.5 3" />
        <text
          x={Math.min(Math.max(paceX, 96), 904)}
          y={BASE_Y + 20}
          textAnchor="middle"
          fontSize="10"
          fontWeight="700"
          letterSpacing="1"
          fill="var(--color-accent)"
        >
          PACE TODAY
        </text>
      </g>

      {/* summit projections — hollow markers at the current 14-day pace */}
      {placed.map((c) => {
        const pf = projections[c.block.id];
        if (pf <= c.f + 0.008) return null;
        const [px, py] = pointAt(pf);
        return (
          <g key={`proj-${c.block.id}`} opacity="0.85">
            <line
              x1={c.x}
              y1={c.y}
              x2={px}
              y2={py}
              stroke={`var(${c.block.colorVar})`}
              strokeWidth="1"
              strokeDasharray="1.5 4"
              opacity="0.55"
            />
            <circle cx={px} cy={py} r="4.5" fill="var(--color-surface)" stroke={`var(${c.block.colorVar})`} strokeWidth="1.6" strokeDasharray="2 2" />
            <title>{`${c.block.label}: projected ${(pf * 100).toFixed(0)}% of required hours by Prelims at the current 14-day pace`}</title>
          </g>
        );
      })}

      {/* the rope */}
      <polyline points={ropeStr} fill="none" stroke="var(--color-text-muted)" strokeWidth="1.2" strokeDasharray="1.5 3" opacity="0.9" />

      {/* CSAT rope fray warning */}
      {csat.level !== 'ok' && csatClimber && (
        <g>
          <circle
            cx={csatClimber.x}
            cy={csatClimber.y}
            r="12"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="1.6"
            strokeDasharray="3 3"
            className="halo-pulse"
          />
          <title>{`CSAT rope fraying — ${csat.daysSince} days without CSAT practice`}</title>
        </g>
      )}

      {/* climbers */}
      {placed.map((c) => (
        <g key={c.block.id}>
          <circle cx={c.x} cy={c.y} r="6.5" fill={`var(${c.block.colorVar})`} stroke="var(--color-surface)" strokeWidth="2" />
          <title>{`${c.block.label}: ${(c.f * 100).toFixed(1)}% of the required hours climbed`}</title>
        </g>
      ))}
    </svg>
  );
}
