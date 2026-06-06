import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { formatCompactEur, formatEur } from '../core/money/format';

export interface ChartPoint {
  date: Date;
  value: number;
}

const dateFmt = new Intl.DateTimeFormat('it-IT', { month: 'short', year: 'numeric' });
const axisDateFmt = new Intl.DateTimeFormat('it-IT', { month: 'short', year: '2-digit' });

/**
 * Grafico ad area interattivo (SVG, zero dipendenze) con assi leggibili: valori € sull'asse Y,
 * mesi sull'asse X e griglia orizzontale. Il plot SVG si stira (preserveAspectRatio="none"), ma le
 * etichette degli assi sono HTML attorno al plot, così restano nitide e non deformate. Al passaggio
 * di mouse/dito mostra valore e data del punto.
 */
@Component({
  selector: 'app-value-chart',
  template: `
    @if (points().length >= 2) {
      <div class="readout">
        <span class="num val">{{ eur(activeValue()) }}</span>
        <span class="muted date">{{ activeDate() }}</span>
      </div>
      <div class="frame">
        <div class="y-axis">
          @for (t of yTicks(); track t.y) {
            <span>{{ t.label }}</span>
          }
        </div>
        <svg
          class="svg"
          [attr.viewBox]="'0 0 ' + W + ' ' + H"
          preserveAspectRatio="none"
          (mousemove)="onMouse($event)"
          (mouseleave)="hover.set(null)"
          (touchstart)="onTouch($event)"
          (touchmove)="onTouch($event)"
        >
          @for (t of yTicks(); track t.y) {
            <line x1="0" [attr.x2]="W" [attr.y1]="t.y" [attr.y2]="t.y" class="grid" />
          }
          <path [attr.d]="geo().area" class="area" />
          <path [attr.d]="geo().line" class="line" />
          @if (marker(); as m) {
            <line [attr.x1]="m.x" [attr.x2]="m.x" y1="0" [attr.y2]="H" class="vline" />
            <circle [attr.cx]="m.x" [attr.cy]="m.y" r="3.5" class="dot" />
          }
        </svg>
        <div class="x-axis">
          @for (t of xTicks(); track t.i) {
            <span>{{ t.label }}</span>
          }
        </div>
      </div>
    } @else {
      <p class="muted">Dati insufficienti per il grafico.</p>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .readout {
        display: flex;
        align-items: baseline;
        gap: var(--space-3);
        margin-bottom: var(--space-2);
      }
      .val {
        font-size: 1.25rem;
        font-weight: var(--fw-bold);
      }
      .date {
        font-size: var(--fs-label);
        text-transform: capitalize;
      }
      .frame {
        display: grid;
        grid-template-columns: auto 1fr;
        grid-template-rows: 1fr auto;
        column-gap: var(--space-2);
      }
      .y-axis {
        grid-column: 1;
        grid-row: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        text-align: right;
        padding: 5px 0;
        font-size: var(--fs-small);
        color: var(--text-muted);
        font-variant-numeric: tabular-nums;
      }
      .svg {
        grid-column: 2;
        grid-row: 1;
        width: 100%;
        height: 170px;
        overflow: visible;
        touch-action: none;
        cursor: crosshair;
      }
      .x-axis {
        grid-column: 2;
        grid-row: 2;
        display: flex;
        justify-content: space-between;
        margin-top: var(--space-1);
        font-size: var(--fs-small);
        color: var(--text-muted);
        text-transform: capitalize;
      }
      .grid {
        stroke: var(--border);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }
      .line {
        fill: none;
        stroke: var(--accent);
        stroke-width: 2;
        vector-effect: non-scaling-stroke;
      }
      .area {
        fill: var(--accent-soft);
        stroke: none;
        opacity: 0.7;
      }
      .vline {
        stroke: var(--border-strong);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }
      .dot {
        fill: var(--accent);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValueChartComponent {
  readonly points = input<ChartPoint[]>([]);

  protected readonly W = 600;
  protected readonly H = 170;
  private readonly pad = 6;
  protected readonly hover = signal<number | null>(null);

  /** Dominio verticale condiviso da area, griglia e tacche. */
  private readonly scale = computed(() => {
    const vals = this.points().map((p) => p.value);
    if (vals.length < 2) return null;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return { min, max, range: max - min || 1 };
  });

  private yAt(v: number, s: { min: number; range: number }): number {
    return this.pad + (1 - (v - s.min) / s.range) * (this.H - 2 * this.pad);
  }

  protected readonly geo = computed(() => {
    const pts = this.points();
    const s = this.scale();
    if (!s || pts.length < 2)
      return { line: '', area: '', coords: [] as { x: number; y: number }[] };
    const coords = pts.map((p, i) => ({
      x: this.pad + (i / (pts.length - 1)) * (this.W - 2 * this.pad),
      y: this.yAt(p.value, s),
    }));
    const line = coords
      .map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');
    const area =
      `M${this.pad} ${(this.H - this.pad).toFixed(1)} ` +
      coords.map((c) => `L${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ') +
      ` L${(this.W - this.pad).toFixed(1)} ${(this.H - this.pad).toFixed(1)} Z`;
    return { line, area, coords };
  });

  /** Tacche dell'asse Y (valori €), dall'alto (max) in basso (min). */
  protected readonly yTicks = computed(() => {
    const s = this.scale();
    if (!s) return [] as { y: number; label: string }[];
    const N = 4;
    return Array.from({ length: N }, (_, i) => {
      const v = s.max - s.range * (i / (N - 1));
      return { y: this.yAt(v, s), label: formatCompactEur(v) };
    });
  });

  /** Tacche dell'asse X (date), da sinistra a destra. */
  protected readonly xTicks = computed(() => {
    const pts = this.points();
    const n = pts.length;
    if (n < 2) return [] as { i: number; label: string }[];
    const N = Math.min(5, n);
    const seen = new Set<number>();
    const out: { i: number; label: string }[] = [];
    for (let k = 0; k < N; k++) {
      const i = Math.round((k * (n - 1)) / (N - 1));
      if (seen.has(i)) continue;
      seen.add(i);
      out.push({ i, label: axisDateFmt.format(pts[i].date) });
    }
    return out;
  });

  protected readonly activeIndex = computed(() => this.hover() ?? this.points().length - 1);
  protected readonly activeValue = computed(() => this.points()[this.activeIndex()]?.value ?? 0);
  protected readonly activeDate = computed(() => {
    const p = this.points()[this.activeIndex()];
    return p ? dateFmt.format(p.date) : '';
  });
  protected readonly marker = computed(() => {
    const i = this.hover();
    if (i === null) return null;
    return this.geo().coords[i] ?? null;
  });

  protected onMouse(e: MouseEvent): void {
    this.setHoverFromX(e.clientX, e.currentTarget as Element);
  }
  protected onTouch(e: TouchEvent): void {
    const t = e.touches[0];
    if (t) this.setHoverFromX(t.clientX, e.currentTarget as Element);
  }
  private setHoverFromX(clientX: number, el: Element): void {
    const n = this.points().length;
    if (n < 2) return;
    const r = el.getBoundingClientRect();
    const i = Math.round(((clientX - r.left) / r.width) * (n - 1));
    this.hover.set(Math.max(0, Math.min(n - 1, i)));
  }

  protected eur(v: number): string {
    return formatEur(v);
  }
}
