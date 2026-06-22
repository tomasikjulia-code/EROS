export function downsampleTrend(data, maxPoints = 200) {
  if (!data || data.length <= maxPoints) return data;
  const step = (data.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) => data[Math.round(i * step)]);
}

export function generateBpmTrendSvg(trend) {
  trend = downsampleTrend(trend);
  if (!trend || trend.length < 2) return '';
  const W = 700, H = 200, PL = 40, PR = 10, PT = 15, PB = 28;
  const dW = W - PL - PR, dH = H - PT - PB;
  const bpmV = trend.map(d => d.bpm);
  const mn = Math.max(0, Math.floor((Math.min(...bpmV) - 5) / 10) * 10);
  const mx = Math.ceil((Math.max(...bpmV) + 5) / 10) * 10;
  const rng = mx - mn || 1;
  const gX = i => PL + (i / (trend.length - 1)) * dW;
  const gY = b => PT + dH - ((b - mn) / rng) * dH;
  const pD = trend.map((d, i) => `${i === 0 ? 'M' : 'L'}${gX(i).toFixed(1)},${gY(d.bpm).toFixed(1)}`).join('');
  const aD = `${pD}L${gX(trend.length - 1).toFixed(1)},${(PT + dH).toFixed(1)}L${PL.toFixed(1)},${(PT + dH).toFixed(1)}Z`;
  const nY = 3;
  const yL = Array.from({ length: nY }, (_, i) => ({ y: gY(mn + (rng / (nY - 1)) * i), l: Math.round(mn + (rng / (nY - 1)) * i) }));
  const nX = Math.min(7, Math.max(3, Math.floor(trend.length / 15)));
  const xL = Array.from({ length: nX }, (_, i) => {
    const idx = Math.floor(i * (trend.length - 1) / (nX - 1));
    const s = Math.floor(trend[idx].timeMs / 1000);
    return { x: gX(idx), l: `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}` };
  });
  return `<svg width="100%" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6366f1" stop-opacity="0.15"/><stop offset="100%" stop-color="#6366f1" stop-opacity="0"/></linearGradient></defs>${yL.map(l => `<line x1="${PL}" y1="${l.y.toFixed(1)}" x2="${W - PR}" y2="${l.y.toFixed(1)}" stroke="#e0e0e0" stroke-width="1" stroke-dasharray="4,4"/><text x="${PL - 6}" y="${(l.y + 4).toFixed(1)}" fill="#666" font-size="10" text-anchor="end">${l.l}</text>`).join('')}${xL.map(l => `<text x="${l.x.toFixed(1)}" y="${H - 8}" fill="#666" font-size="9" text-anchor="middle">${l.l}</text>`).join('')}<path d="${aD}" fill="url(#bg)"/><path d="${pD}" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

export function generateActivityTrendSvg(trend) {
  trend = downsampleTrend(trend);
  if (!trend || trend.length < 2) return '';
  const W = 700, H = 150, PL = 40, PR = 10, PT = 10, PB = 25;
  const dW = W - PL - PR, dH = H - PT - PB;
  const maxA = 10;
  const gX = i => PL + (i / (trend.length - 1)) * dW;
  const gY = a => PT + dH - (Math.min(a || 0, maxA) / maxA) * dH;
  const pD = trend.map((d, i) => `${i === 0 ? 'M' : 'L'}${gX(i).toFixed(1)},${gY(d.activity || 0).toFixed(1)}`).join('');
  const aD = `${pD}L${gX(trend.length - 1).toFixed(1)},${(PT + dH).toFixed(1)}L${PL.toFixed(1)},${(PT + dH).toFixed(1)}Z`;
  const nX = Math.min(7, Math.max(3, Math.floor(trend.length / 15)));
  const xL = Array.from({ length: nX }, (_, i) => {
    const idx = Math.floor(i * (trend.length - 1) / (nX - 1));
    const s = Math.floor(trend[idx].timeMs / 1000);
    return { x: gX(idx), l: `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}` };
  });
  return `<svg width="100%" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#34d399" stop-opacity="0.2"/><stop offset="100%" stop-color="#34d399" stop-opacity="0"/></linearGradient></defs><line x1="${PL}" y1="${PT}" x2="${PL}" y2="${PT + dH}" stroke="#e0e0e0" stroke-width="1"/><line x1="${PL}" y1="${(PT + dH / 2).toFixed(1)}" x2="${W - PR}" y2="${(PT + dH / 2).toFixed(1)}" stroke="#e0e0e0" stroke-width="1" stroke-dasharray="4,4"/><line x1="${PL}" y1="${PT + dH}" x2="${W - PR}" y2="${PT + dH}" stroke="#e0e0e0" stroke-width="1"/><text x="${PL - 6}" y="${PT + 4}" fill="#666" font-size="10" text-anchor="end">100%</text><text x="${PL - 6}" y="${(PT + dH / 2 + 4).toFixed(1)}" fill="#666" font-size="10" text-anchor="end">50%</text><text x="${PL - 6}" y="${PT + dH + 4}" fill="#666" font-size="10" text-anchor="end">0%</text>${xL.map(l => `<text x="${l.x.toFixed(1)}" y="${H - 8}" fill="#666" font-size="9" text-anchor="middle">${l.l}</text>`).join('')}<path d="${aD}" fill="url(#ag)"/><path d="${pD}" fill="none" stroke="#34d399" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

export function generateEcgStripSvg(data) {
  if (!data || data.length < 2) return '';
  const W = 600, H = 100, PL = 5, PR = 5, PT = 5, PB = 5;
  const dW = W - PL - PR, dH = H - PT - PB;
  const mn = Math.min(...data), mx = Math.max(...data), rng = (mx - mn) || 1;
  const gX = i => PL + (i / (data.length - 1)) * dW;
  const gY = v => PT + dH - ((v - mn) / rng) * dH;
  const pD = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${gX(i).toFixed(1)},${gY(v).toFixed(1)}`).join('');
  return `<svg width="100%" viewBox="0 0 ${W} ${H}"><rect x="0" y="0" width="${W}" height="${H}" fill="#f8f8f8" rx="4"/><path d="${pD}" fill="none" stroke="#10b981" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
