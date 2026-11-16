'use client';

import { useEffect, useRef, useState } from 'react';

export interface BarDatum {
  key: string;
  label: string;
  value: number;
}

const HEIGHT = 220;
const M = { top: 12, right: 8, bottom: 28, left: 64 };
const MAX_BAR = 24;

/** 0, 1·10ⁿ, 2·10ⁿ, 5·10ⁿ… so axis ticks read cleanly. */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= v) ?? 10 * p;
}

/** Bar with a 4px rounded data-end and a square baseline end (dataviz spec). */
function barPath(x: number, w: number, y0: number, y1: number) {
  const r = Math.min(4, w / 2, Math.abs(y1 - y0));
  if (y1 <= y0) {
    return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
  }
  return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
}

/**
 * Single-series bar chart (one hue, no legend — the title names the series).
 * Thin bars from one zero baseline, recessive grid, hover/focus tooltip.
 * The page renders the same data as a table (accessible view).
 */
export function BarChart({
  data,
  title,
  format,
  color = 'var(--color-primary)',
}: {
  data: BarDatum[];
  title: string;
  format: (v: number) => string;
  color?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => entry && setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const values = data.map((d) => d.value);
  const top = niceMax(Math.max(0, ...values));
  const bottom = -niceMax(Math.max(0, ...values.map((v) => -v))) * (values.some((v) => v < 0) ? 1 : 0);
  const innerW = width - M.left - M.right;
  const innerH = HEIGHT - M.top - M.bottom;
  const y = (v: number) => M.top + ((top - v) / (top - bottom)) * innerH;
  const band = innerW / Math.max(1, data.length);
  const barW = Math.min(MAX_BAR, band * 0.6);
  const ticks = [bottom, ...(bottom < 0 ? [0] : []), top / 2, top].filter((v, i, a) => a.indexOf(v) === i);
  // Thin out x labels when crowded.
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 56)));

  return (
    <div ref={box} className="relative">
      <svg width={width} height={HEIGHT} role="img" aria-label={title} className="block">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={M.left - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--color-muted)">
              {format(v)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = M.left + i * band + (band - barW) / 2;
          return (
            <g key={d.key}>
              {d.value !== 0 && (
                <path d={barPath(x, barW, y(0), y(d.value))} fill={color} opacity={active === null || active === i ? 1 : 0.45} />
              )}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="var(--color-muted)">
                  {d.label}
                </text>
              )}
              {/* Hit target: the whole band, bigger than the bar. */}
              <rect
                x={M.left + i * band}
                y={M.top}
                width={band}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.label}: ${format(d.value)}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none"
              />
            </g>
          );
        })}
      </svg>
      {active !== null && data[active] && (
        <div
          role="tooltip"
          className="pointer-events-none absolute rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(width - 140, Math.max(0, M.left + active * band + band / 2 - 70)),
            top: Math.max(0, y(Math.max(0, data[active].value)) - 52),
            width: 140,
          }}
        >
          <p className="text-muted">{data[active].label}</p>
          <p className="font-semibold text-ink">{format(data[active].value)}</p>
        </div>
      )}
    </div>
  );
}
