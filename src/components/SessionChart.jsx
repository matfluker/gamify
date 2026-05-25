import React from 'react';
import { CARDS_PER_SESSION, ACCENT_SUCCESS, ACCENT_ERROR } from '../config.js';

// Smoothed line chart only — no bars. Line color is based on the most recent
// session compared to the prior session:
//   improvement OR same  -> green
//   worse                -> red
export default function SessionChart({ data }) {
  const max = CARDS_PER_SESSION;
  const width = 320, height = 160, pad = 24;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const slots = Math.max(data.length, 5);

  const xFor = (i) => pad + (innerW * (i + 0.5)) / slots;
  const yFor = (v) => pad + innerH - (v / max) * innerH;

  const points = data.map((d, i) => ({ x: xFor(i), y: yFor(d.correct) }));

  // Catmull-Rom -> cubic Bezier so the line reads as smooth.
  function smoothPath(pts) {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }

  // Pick line color from most recent vs prior session.
  let lineColor = ACCENT_SUCCESS;
  if (data.length >= 2) {
    const last = data[data.length - 1].correct;
    const prev = data[data.length - 2].correct;
    lineColor = last >= prev ? ACCENT_SUCCESS : ACCENT_ERROR;
  }

  const path = smoothPath(points);

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Last sessions chart">
      {[0, 5, 10].map(v => (
        <g key={v}>
          <line x1={pad} y1={yFor(v)} x2={width - pad} y2={yFor(v)} stroke="#eee" />
          <text x={pad - 6} y={yFor(v) + 4} fontSize="10" fill="#aaa" textAnchor="end">{v}</text>
        </g>
      ))}
      {points.length > 1 ? (
        <path d={path} fill="none" stroke={lineColor} strokeWidth="3"
          strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill={lineColor} />
      ))}
    </svg>
  );
}
