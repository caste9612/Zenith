// Renderer canvas → PNG (dataURL) per il foglio "Grafici" dell'export. Colori ESPLICITI (niente
// variabili CSS, che non si serializzano) e nessuna dipendenza dai componenti/DOM dell'app.
// Gira nel browser durante l'export (canvas disponibile).

import { formatCompactEur } from '../money/format';

const W = 900;
const H = 380;
const PAD = 56;
const monthShort = new Intl.DateTimeFormat('it-IT', { month: 'short', year: '2-digit' });

function newCanvas(): { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'middle';
  return { cv, ctx };
}

function title(ctx: CanvasRenderingContext2D, text: string): void {
  ctx.fillStyle = '#212529';
  ctx.textAlign = 'left';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(text, PAD, 22);
}

/** Andamento del patrimonio netto (area + linea). `null` se meno di 2 punti. */
export function netWorthChartPng(points: { date: Date; value: number }[]): string | null {
  if (points.length < 2) return null;
  const c = newCanvas();
  if (!c) return null;
  const { cv, ctx } = c;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD - 24);
  const y = (v: number) => H - PAD - ((v - min) / range) * (H - PAD - 36);

  ctx.font = '13px sans-serif';
  for (let k = 0; k <= 4; k++) {
    const v = min + (range * k) / 4;
    const yy = y(v);
    ctx.strokeStyle = '#e9ecef';
    ctx.beginPath();
    ctx.moveTo(PAD, yy);
    ctx.lineTo(W - 24, yy);
    ctx.stroke();
    ctx.fillStyle = '#868e96';
    ctx.textAlign = 'right';
    ctx.fillText(formatCompactEur(v), PAD - 8, yy);
  }
  ctx.beginPath();
  ctx.moveTo(x(0), y(vals[0]));
  for (let i = 1; i < points.length; i++) ctx.lineTo(x(i), y(vals[i]));
  ctx.strokeStyle = '#3b5bdb';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.lineTo(x(points.length - 1), y(min));
  ctx.lineTo(x(0), y(min));
  ctx.closePath();
  ctx.fillStyle = 'rgba(59,91,219,0.12)';
  ctx.fill();

  ctx.fillStyle = '#868e96';
  ctx.textAlign = 'center';
  const n = Math.min(6, points.length);
  for (let k = 0; k < n; k++) {
    const i = Math.round((k * (points.length - 1)) / (n - 1));
    ctx.fillText(monthShort.format(points[i].date), x(i), H - PAD + 18);
  }
  title(ctx, 'Patrimonio netto — ' + formatCompactEur(vals[vals.length - 1]));
  return cv.toDataURL('image/png');
}

/** Torta della ripartizione (con legenda). `null` se nessun valore positivo. */
export function pieChartPng(items: { label: string; value: number; color: string }[]): string | null {
  const pos = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = pos.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return null;
  const c = newCanvas();
  if (!c) return null;
  const { cv, ctx } = c;
  const cx = 210;
  const cy = H / 2 + 10;
  const r = 132;
  let a = -Math.PI / 2;
  for (const it of pos) {
    const a1 = a + (it.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a, a1);
    ctx.closePath();
    ctx.fillStyle = it.color;
    ctx.fill();
    a = a1;
  }
  ctx.textAlign = 'left';
  ctx.font = '14px sans-serif';
  let ly = 70;
  for (const it of pos) {
    ctx.fillStyle = it.color;
    ctx.fillRect(440, ly - 7, 14, 14);
    ctx.fillStyle = '#212529';
    ctx.fillText(`${it.label} — ${Math.round((it.value / total) * 100)}%`, 462, ly);
    ly += 28;
  }
  title(ctx, 'Ripartizione per classe');
  return cv.toDataURL('image/png');
}

/** Barre (verde/rosso) di una serie a frazioni (es. tasso di risparmio mese su mese). */
export function barChartPng(
  bars: { date: Date; value: number | null }[],
  heading: string,
): string | null {
  const present = bars.map((b) => b.value).filter((v): v is number => v != null);
  if (!present.length) return null;
  const c = newCanvas();
  if (!c) return null;
  const { cv, ctx } = c;
  const min = Math.min(0, ...present);
  const max = Math.max(0, ...present);
  const range = max - min || 1;
  const y = (v: number) => H - PAD - ((v - min) / range) * (H - PAD - 36);
  const x = (i: number) => PAD + (i / bars.length) * (W - PAD - 24);
  const bw = Math.max(2, ((W - PAD - 24) / bars.length) * 0.7);
  const zero = y(0);

  ctx.font = '13px sans-serif';
  for (let k = 0; k <= 4; k++) {
    const v = min + (range * k) / 4;
    const yy = y(v);
    ctx.strokeStyle = '#e9ecef';
    ctx.beginPath();
    ctx.moveTo(PAD, yy);
    ctx.lineTo(W - 24, yy);
    ctx.stroke();
    ctx.fillStyle = '#868e96';
    ctx.textAlign = 'right';
    ctx.fillText((v * 100).toFixed(0) + '%', PAD - 8, yy);
  }
  bars.forEach((b, i) => {
    if (b.value == null) return;
    const yy = y(b.value);
    ctx.fillStyle = b.value >= 0 ? '#12b886' : '#e03131';
    ctx.fillRect(x(i), Math.min(yy, zero), bw, Math.max(1, Math.abs(zero - yy)));
  });
  ctx.fillStyle = '#868e96';
  ctx.textAlign = 'center';
  const n = Math.min(6, bars.length);
  for (let k = 0; k < n; k++) {
    const i = Math.round((k * (bars.length - 1)) / (n - 1));
    ctx.fillText(monthShort.format(bars[i].date), x(i) + bw / 2, H - PAD + 18);
  }
  title(ctx, heading);
  return cv.toDataURL('image/png');
}
