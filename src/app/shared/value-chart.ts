import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { formatEur } from '../core/money/format';

export interface ChartPoint {
  date: Date;
  value: number;
}

const dateFmt = new Intl.DateTimeFormat('it-IT', { month: 'short', year: 'numeric' });

/**
 * Grafico ad area interattivo (SVG, zero dipendenze). Al passaggio di mouse/dito mostra
 * valore e data del punto. Riusabile (portafoglio, dashboard…).
 */
@Component({
  selector: 'app-value-chart',
  template: `
    @if (points().length >= 2) {
      <div class="readout">
        <span class="num val">{{ eur(activeValue()) }}</span>
        <span class="muted date">{{ activeDate() }}</span>
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
        <path [attr.d]="geo().area" class="area" />
        <path [attr.d]="geo().line" class="line" />
        @if (marker(); as m) {
          <line [attr.x1]="m.x" [attr.x2]="m.x" y1="0" [attr.y2]="H" class="vline" />
          <circle [attr.cx]="m.x" [attr.cy]="m.y" r="3.5" class="dot" />
        }
      </svg>
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
      .svg {
        width: 100%;
        height: 160px;
        overflow: visible;
        touch-action: none;
        cursor: crosshair;
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
  protected readonly H = 160;
  protected readonly hover = signal<number | null>(null);

  protected readonly geo = computed(() => {
    const pts = this.points();
    const pad = 6;
    if (pts.length < 2) return { line: '', area: '', coords: [] as { x: number; y: number }[] };
    const vals = pts.map((p) => p.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const coords = pts.map((p, i) => ({
      x: pad + (i / (pts.length - 1)) * (this.W - 2 * pad),
      y: pad + (1 - (p.value - min) / range) * (this.H - 2 * pad),
    }));
    const line = coords
      .map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');
    const area =
      `M${pad} ${(this.H - pad).toFixed(1)} ` +
      coords.map((c) => `L${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ') +
      ` L${(this.W - pad).toFixed(1)} ${(this.H - pad).toFixed(1)} Z`;
    return { line, area, coords };
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
