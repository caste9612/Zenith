import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { formatEur, formatPercentPlain } from '../core/money/format';

const dateFmt = new Intl.DateTimeFormat('it-IT', { month: 'short', year: 'numeric' });

/**
 * Mini grafico a BARRE (SVG, zero dipendenze) per una serie mensile in **frazione** (0,2 = 20%),
 * es. il tasso di risparmio. Baseline allo zero (gestisce anche valori negativi). Al passaggio di
 * mouse/dito mostra mese e percentuale del mese attivo.
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
      <svg
        class="svg"
        [attr.viewBox]="'0 0 ' + W + ' ' + H"
        preserveAspectRatio="none"
        (mousemove)="onMouse($event)"
        (mouseleave)="hover.set(null)"
        (touchstart)="onTouch($event)"
        (touchmove)="onTouch($event)"
      >
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
      .svg {
        width: 100%;
        height: 160px;
        overflow: visible;
        touch-action: none;
        cursor: crosshair;
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
        fill: var(--loss, #e03131);
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
    return { min, range: max - min || 1 };
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

  protected readonly activeIndex = computed(() => {
    if (this.hover() !== null) return this.hover()!;
    // default: ultimo mese con un valore
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
}
