import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { formatCompactEur, formatEur, formatPercentPlain } from '../core/money/format';

const dateFmt = new Intl.DateTimeFormat('it-IT', { month: 'short', year: 'numeric' });
const axisDateFmt = new Intl.DateTimeFormat('it-IT', { month: 'short', year: '2-digit' });

/**
 * Grafico a BARRE (SVG, zero dipendenze) con assi leggibili: valore sull'asse Y (€ o %), mesi
 * sull'asse X, griglia + linea dello zero (gestisce valori negativi). Le etichette degli assi sono
 * HTML attorno al plot. Al passaggio mostra mese e valore. Usato per risparmio €/mese e tasso %.
 */
@Component({
  selector: 'app-bar-chart',
  template: `
    @if (hasData()) {
      <div class="readout">
        <span class="muted date">{{ activeDate() }}</span>
        <span class="num val" [class.gain]="activeValue()! > 0" [class.loss]="activeValue()! < 0">{{
          activeValue() === null ? '—' : fmt(activeValue()!)
        }}</span>
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
          <line x1="0" [attr.x2]="W" [attr.y1]="zeroY()" [attr.y2]="zeroY()" class="zero" />
          @for (b of bars(); track b.i) {
            <rect
              [attr.x]="b.x"
              [attr.y]="b.y"
              [attr.width]="b.w"
              [attr.height]="b.h"
              class="bar"
              [class.neg]="b.neg"
              [class.active]="b.i === activeIndex()"
            />
          }
        </svg>
        <div class="x-axis">
          @for (t of xTicks(); track t.i) {
            <span>{{ t.label }}</span>
          }
        </div>
      </div>
    } @else {
      <p class="muted">Nessun dato.</p>
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
        justify-content: space-between;
        gap: var(--space-3);
        margin-bottom: var(--space-1);
      }
      .date {
        font-size: var(--fs-label);
        text-transform: capitalize;
        font-weight: var(--fw-medium);
      }
      .val {
        font-size: 1.1rem;
        font-weight: var(--fw-bold);
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
        height: 160px;
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
      .zero {
        stroke: var(--border-strong);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }
      .bar {
        fill: var(--accent);
        opacity: 0.55;
      }
      .bar.neg {
        fill: var(--negative, #e03131);
      }
      .bar.active {
        opacity: 1;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarChartComponent {
  readonly labels = input<Date[]>([]);
  /** Valori; `null` = barra assente. In `percent` sono frazioni (0,2 = 20%); in `eur` sono importi. */
  readonly values = input<(number | null)[]>([]);
  /** Formato del valore mostrato: percentuale (default) o euro. */
  readonly format = input<'percent' | 'eur'>('percent');

  protected readonly W = 600;
  protected readonly H = 160;
  protected readonly hover = signal<number | null>(null);

  protected readonly hasData = computed(() =>
    this.values().some((v) => v !== null && Number.isFinite(v)),
  );

  private readonly domain = computed(() => {
    const vals = this.values().filter((v): v is number => v !== null && Number.isFinite(v));
    const min = Math.min(0, ...vals);
    const max = Math.max(0, ...vals);
    return { min, max, range: max - min || 1 };
  });

  private readonly pad = 6;
  private yAt(v: number): number {
    const { min, range } = this.domain();
    return this.pad + (1 - (v - min) / range) * (this.H - 2 * this.pad);
  }
  protected zeroY(): number {
    return this.yAt(0);
  }

  protected readonly bars = computed(() => {
    const vals = this.values();
    const n = vals.length;
    if (!n) return [] as { i: number; x: number; y: number; w: number; h: number; neg: boolean }[];
    const slot = (this.W - 2 * this.pad) / n;
    const w = Math.max(1, slot * 0.7);
    const z = this.yAt(0);
    const out: { i: number; x: number; y: number; w: number; h: number; neg: boolean }[] = [];
    vals.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) return;
      const y = this.yAt(v);
      out.push({
        i,
        x: this.pad + slot * i + (slot - w) / 2,
        y: Math.min(y, z),
        w,
        h: Math.max(1, Math.abs(z - y)),
        neg: v < 0,
      });
    });
    return out;
  });

  /** Tacche dell'asse Y (da max in alto a min in basso), formattate secondo `format`. */
  protected readonly yTicks = computed(() => {
    if (!this.hasData()) return [] as { y: number; label: string }[];
    const { min, max } = this.domain();
    const N = 4;
    return Array.from({ length: N }, (_, i) => {
      const v = max - ((max - min) * i) / (N - 1);
      return { y: this.yAt(v), label: this.axisLabel(v) };
    });
  });

  /** Tacche dell'asse X (date), da sinistra a destra. */
  protected readonly xTicks = computed(() => {
    const labels = this.labels();
    const n = labels.length;
    if (n < 2) return [] as { i: number; label: string }[];
    const N = Math.min(5, n);
    const seen = new Set<number>();
    const out: { i: number; label: string }[] = [];
    for (let k = 0; k < N; k++) {
      const i = Math.round((k * (n - 1)) / (N - 1));
      if (seen.has(i)) continue;
      seen.add(i);
      out.push({ i, label: axisDateFmt.format(labels[i]) });
    }
    return out;
  });

  protected readonly activeIndex = computed(() => {
    if (this.hover() !== null) return this.hover()!;
    const vals = this.values();
    for (let i = vals.length - 1; i >= 0; i--)
      if (vals[i] !== null && Number.isFinite(vals[i]!)) return i;
    return vals.length - 1;
  });
  protected readonly activeValue = computed(() => this.values()[this.activeIndex()] ?? null);
  protected readonly activeDate = computed(() => {
    const d = this.labels()[this.activeIndex()];
    return d ? dateFmt.format(d) : '';
  });

  protected onMouse(e: MouseEvent): void {
    this.setHoverFromX(e.clientX, e.currentTarget as Element);
  }
  protected onTouch(e: TouchEvent): void {
    const t = e.touches[0];
    if (t) this.setHoverFromX(t.clientX, e.currentTarget as Element);
  }
  private setHoverFromX(clientX: number, el: Element): void {
    const n = this.labels().length;
    if (!n) return;
    const r = el.getBoundingClientRect();
    const i = Math.floor(((clientX - r.left) / r.width) * n);
    this.hover.set(Math.max(0, Math.min(n - 1, i)));
  }

  protected fmt(v: number): string {
    return this.format() === 'eur' ? formatEur(v) : formatPercentPlain(v);
  }
  /** Etichetta dell'asse Y: € compatto o percentuale. */
  private axisLabel(v: number): string {
    return this.format() === 'eur' ? formatCompactEur(v) : formatPercentPlain(v);
  }
}
