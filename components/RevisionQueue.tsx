'use client';

import { useEffect, useState } from 'react';
import { BLOCKS, BlockId, daysBetween } from '@/lib/blocks';

export interface RevisionItem {
  id: number;
  title: string;
  block: BlockId;
  stage: number;
  studied_on: string;
  next_review: string;
  completed?: boolean;
}

const STAGE_LABEL = ['R1 · +1d', 'R2 · +7d', 'R3 · +21d', 'R4 · +60d'];

interface Props {
  today: string;
}

export default function RevisionQueue({ today }: Props) {
  const [items, setItems] = useState<RevisionItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState('');
  const [block, setBlock] = useState<BlockId>('gs_static');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/revision')
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const due = items.filter((i) => i.next_review <= today);
  const upcoming = items.filter((i) => i.next_review > today);
  const nextWeek = upcoming.filter((i) => daysBetween(today, i.next_review) <= 7);

  const add = async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', title: t, block, studiedOn: today }),
      }).then((r) => r.json());
      if (res.item) {
        setItems((prev) =>
          [...prev, res.item].sort((a, b) => a.next_review.localeCompare(b.next_review))
        );
        setTitle('');
      }
    } finally {
      setBusy(false);
    }
  };

  const review = async (id: number) => {
    const res = await fetch('/api/revision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'review', id, today }),
    }).then((r) => r.json());
    setItems((prev) => {
      const rest = prev.filter((i) => i.id !== id);
      if (res.item && !res.item.completed) {
        return [...rest, res.item].sort((a, b) => a.next_review.localeCompare(b.next_review));
      }
      return rest;
    });
  };

  const remove = async (id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch('/api/revision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', id }),
    }).catch(() => undefined);
  };

  return (
    <section className="rq-panel" aria-label="Spaced revision queue">
      <div className="rq-head">
        <h2>Revision Queue</h2>
        {due.length > 0 ? (
          <span className="rq-badge num">{due.length} due</span>
        ) : (
          <span className="rq-badge quiet num">0 due</span>
        )}
        <span className="micro rq-upcoming">
          {nextWeek.length > 0 ? `${nextWeek.length} resurfacing this week` : `${upcoming.length} in rotation`}
        </span>
      </div>

      {loaded && due.length === 0 && (
        <p className="rq-empty">
          Nothing due. Log what you studied today — it resurfaces at 1, 7, 21 and 60 days.
        </p>
      )}

      {due.length > 0 && (
        <ul className="rq-list" role="list">
          {due.map((i) => {
            const b = BLOCKS.find((x) => x.id === i.block)!;
            const age = daysBetween(i.studied_on, today);
            return (
              <li className="rq-item" key={i.id}>
                <span className="rq-dot" style={{ background: `var(${b.colorVar})` }} />
                <span className="rq-title">{i.title}</span>
                <span className="rq-meta micro">
                  {b.short} · studied {age}d ago · {STAGE_LABEL[i.stage] ?? 'R?'}
                </span>
                <button className="rq-review" onClick={() => review(i.id)}>
                  Reviewed
                </button>
                <button className="rq-remove" onClick={() => remove(i.id)} aria-label={`Remove ${i.title}`}>
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rq-add">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Studied today… e.g. Laxmikanth Ch. 12 — Parliament"
          aria-label="Topic studied today"
          maxLength={200}
        />
        <select value={block} onChange={(e) => setBlock(e.target.value as BlockId)} aria-label="Block">
          {BLOCKS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.short}
            </option>
          ))}
        </select>
        <button className="rq-add-btn" onClick={add} disabled={!title.trim() || busy}>
          Add
        </button>
      </div>
    </section>
  );
}
