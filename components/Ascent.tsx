'use client';

import { BLOCKS, BlockId } from '@/lib/blocks';
import { blockFraction } from '@/lib/stats';

/**
 * The Ascent — five climbers roped together on one mountain.
 * X-progress = share of the block's total required hours (start → Prelims).
 * The hollow ring is the pace marker: where a climber should be today.
 */

const W = 1000;
const H = 340;
const BASE_Y = 296;

/** The route: base camp (left) to summit (right). */
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

const CAMPS: { f: number; label: string }[] = [
  { f: 0.25, label: 'CAMP I' },
  { f: 0.5, label: 'CAMP II' },
  { f: 0.75, label: 'CAMP III' },
];

interface Props {
  cumulative: Record<BlockId, number>;
  targets: Record<BlockId, number>;
  pace: number;
}

export default function Ascent({ cumulative, targets, pace }: Props) {
  const routeStr = ROUTE.map((p) => p.join(',')).join(' ');
  const silhouette = `${routeStr} ${ROUTE[ROUTE.length - 1][0]},${BASE_Y} 52,${BASE_Y}`;

  // Climbers, sorted so the rope drapes from trailing to leading.
  const climbers = BLOCKS.map((b) => ({
    block: b,
    f: blockFraction(cumulative, targets, b.id),
  })).sort((a, b) => a.f - b.f);

  // Stagger climbers that share (almost) the same spot so all five stay visible.
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

  return (
    <svg
      className="ascent-svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Mountain chart showing each study block's progress toward the total hours needed by Prelims 2027"
    >
      {/* precision grid */}
      {Array.from({ length: 9 }, (_, i) => {
        const x = 52 + ((900 - 52) * (i + 1)) / 10;
        return (
          <line
            key={i}
            x1={x}
            y1={40}
            x2={x}
            y2={BASE_Y}
            stroke="var(--color-divider)"
            strokeWidth="1"
          />
        );
      })}

      {/* mountain silhouette */}
      <polygon points={silhouette} fill="var(--color-surface-offset)" opacity="0.85" />
      <polyline
        points={routeStr}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* baseline */}
      <line x1={40} y1={BASE_Y} x2={960} y2={BASE_Y} stroke="var(--color-text)" strokeWidth="1.5" />

      {/* camps */}
      {CAMPS.map((c) => {
        const [x, y] = pointAt(c.f);
        return (
          <g key={c.label}>
            <line x1={x} y1={y} x2={x} y2={y - 12} stroke="var(--color-text-faint)" strokeWidth="1.5" />
            <text
              x={x}
              y={y - 18}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              letterSpacing="1"
              fill="var(--color-text-faint)"
            >
              {c.label}
            </text>
          </g>
        );
      })}

      {/* base camp */}
      <text x={52} y={BASE_Y + 36} fontSize="10" fontWeight="600" letterSpacing="1" fill="var(--color-text-muted)">
        BASE · 21 AUG 2026
      </text>

      {/* summit flag */}
      <g>
        <line x1={summit[0]} y1={summit[1]} x2={summit[0]} y2={summit[1] - 26} stroke="var(--color-text)" strokeWidth="2" />
        <path
          d={`M ${summit[0]} ${summit[1] - 26} l 20 5 l -20 5 Z`}
          fill="var(--color-accent)"
        />
        <text
          x={summit[0] + 6}
          y={summit[1] + 16}
          fontSize="11"
          fontWeight="700"
          letterSpacing="1"
          fill="var(--color-text)"
        >
          AIR 1
        </text>
        <text
          x={summit[0] + 6}
          y={summit[1] + 30}
          fontSize="9.5"
          fontWeight="600"
          letterSpacing="0.5"
          fill="var(--color-text-muted)"
        >
          23 MAY 2027
        </text>
      </g>

      {/* pace marker — where a climber should be today */}
      <g>
        <line
          x1={paceX}
          y1={paceY}
          x2={paceX}
          y2={BASE_Y}
          stroke="var(--color-accent)"
          strokeWidth="1.2"
          strokeDasharray="3 4"
          opacity="0.7"
        />
        <circle
          cx={paceX}
          cy={paceY}
          r="8"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.6"
          strokeDasharray="2.5 3"
        />
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

      {/* the rope */}
      <polyline
        points={ropeStr}
        fill="none"
        stroke="var(--color-text-muted)"
        strokeWidth="1.2"
        strokeDasharray="1.5 3"
        opacity="0.9"
      />

      {/* climbers */}
      {placed.map((c) => (
        <g key={c.block.id}>
          <circle
            cx={c.x}
            cy={c.y}
            r="6.5"
            fill={`var(${c.block.colorVar})`}
            stroke="var(--color-surface)"
            strokeWidth="2"
          />
          <title>
            {`${c.block.label}: ${(c.f * 100).toFixed(1)}% of the required hours climbed`}
          </title>
        </g>
      ))}
    </svg>
  );
}
