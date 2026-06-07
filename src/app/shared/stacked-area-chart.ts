import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { formatCompactEur, formatEur } from '../core/money/format';

export interface StackSeries {
  name: string;
  color: string;
  /** Valori allineati a `labels` (stesso indice). I negativi sono trattati come 0 (impilamento). */
  values: number[];
}

const dateFmt = new Intl.DateTimeFormat('it-IT', { month: 'short', year: 'numeric' });
const axisDateFmt = new Intl.DateTimeFormat('it-IT', { month: 'short', year: '2-digit' });

/**
 * Grafico ad AREA IMPILATA (SVG, zero dipendenze) con assi leggibili: € sull'asse Y, mesi sull'asse
 * X, griglia orizzontale. Le serie si sommano (totale = bordo superiore). Le etichette degli assi
 * sono HTML attorno al plot, così restano nitide. Al passaggio mostra mese, valore di ogni serie e
 * totale. Riusabile (composizione del patrimonio per classe o per intestatario nel tempo).
 */
@Component({
  selector: 'app-stacked-area-chart',
  template: `
    @if (labels().length >= 2 && series().length) {
      <div class="readout">
        <span class="muted date">{{ activeDate() }}</span>
        <span class="num total">{{ eur(total()) }}</span>
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
          @for (a of geo(); track a.name) {
            <path [attr.d]="a.d" class="area" [style.fill]="a.color" />
          }
          @if (markerX(); as mx) {
            <line [attr.x1]="mx" [attr.x2]="mx" y1="0" [attr.y2]="H" class="vline" />
          }
        </svg>
        <div class="x-axis">
          @for (t of xTicks(); track t.i) {
            <span>{{ t.label }}</span>
          }
        </div>
      </div>
      <ul class="legend">
        @for (r of rows(); track r.name) {
          <li>
            <span class="dot" [style.background]="r.color"></span>
            <span class="lname">{{ r.name }}</span>
            <span class="num lval">{{ eur(r.value) }}</span>
          </li>
        }
      </ul>
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
        justify-content: space-between;
        gap: var(--space-3);
        margin-bottom: var(--space-1);
      }
      .date {
        font-size: var(--fs-label);
        text-transform: capitalize;
        font-weight: var(--fw-medium);
      }
      .total {
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
        height: 200px;
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
      .area {
        stroke: var(--surface);
        stroke-width: 0.5;
        vector-effect: non-scaling-stroke;
        opacity: 0.9;
      }
      .vline {
        stroke: var(--border-strong);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }
      .legend {
        list-style: none;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: var(--space-1) var(--space-4);
        margin-top: var(--space-3);
      }
      .legend li {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--fs-label);
      }
      .lname {
        flex: 1;
        color: var(--text-secondary);
      }
      .lval {
        font-weight: var(--fw-semibold);
        font-variant-numeric: tabular-nums;
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 3px;
        flex: none;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StackedAreaChartComponent {
  readonly labels = input<Date[]>([]);
  readonly series = input<StackSeries[]>([]);

  protected readonly W = 600;
  protected readonly H = 200;
  private readonly pad = 6;
  protected readonly hover = signal<number | null>(null);

  /** Totale impilato per ogni mese. */
  private readonly totals = computed(() => {
    const n = this.labels().length;
    const totals = new Array<number>(n).fill(0);
    for (const s of this.series())
      for (let i = 0; i < n; i++) totals[i] += Math.max(0, s.values[i] ?? 0);
    return totals;
  });

  private readonly max = computed(() => Math.max(0, ...this.totals()) || 1);
  private yAt(v: number): number {
    return this.pad + (1 - v / this.max()) * (this.H - 2 * this.pad);
  }

  /** Path SVG di ogni area (bordo superiore L→R, poi baseline R→L). */
  protected readonly geo = computed(() => {
    const labels = this.labels();
    const series = this.series();
    const n = labels.length;
    if (n < 2 || !series.length) return [] as { name: string; color: string; d: string }[];
    const xAt = (i: number) => this.pad + (i / (n - 1)) * (this.W - 2 * this.pad);
    const baseline = new Array<number>(n).fill(0);
    return series.map((s) => {
      const top = baseline.map((b, i) => b + Math.max(0, s.values[i] ?? 0));
      let d = top
        .map((v, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)} ${this.yAt(v).toFixed(1)}`)
        .join(' ');
      for (let i = n - 1; i >= 0; i--)
        d += ` L${xAt(i).toFixed(1)} ${this.yAt(baseline[i]).toFixed(1)}`;
      d += ' Z';
      for (let i = 0; i < n; i++) baseline[i] = top[i];
      return { name: s.name, color: s.color, d };
    });
  });

  /** Tacche dell'asse Y (€), da max (alto) a 0 (basso). */
  protected readonly yTicks = computed(() => {
    if (this.labels().length < 2 || !this.series().length)
      return [] as { y: number; label: string }[];
    const max = this.max();
    const N = 4;
    return Array.from({ length: N }, (_, i) => {
      const v = (max * (N - 1 - i)) / (N - 1);
      return { y: this.yAt(v), label: formatCompactEur(v) };
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

  protected readonly activeIndex = computed(() => this.hover() ?? this.labels().length - 1);

  protected readonly activeDate = computed(() => {
    const d = this.labels()[this.activeIndex()];
    return d ? dateFmt.format(d) : '';
  });

  protected readonly markerX = computed<number | null>(() => {
    const n = this.labels().length;
    if (this.hover() === null || n < 2) return null;
    return this.pad + (this.activeIndex() / (n - 1)) * (this.W - 2 * this.pad);
  });

  /** Righe di legenda con il valore del mese attivo (in ordine di impilamento). */
  protected readonly rows = computed(() => {
    const i = this.activeIndex();
    return this.series().map((s) => ({
      name: s.name,
      color: s.color,
      value: Math.max(0, s.values[i] ?? 0),
    }));
  });

  protected readonly total = computed(() => this.totals()[this.activeIndex()] ?? 0);

  protected onMouse(e: MouseEvent): void {
    this.setHoverFromX(e.clientX, e.currentTarget as Element);
  }
  protected onTouch(e: TouchEvent): void {
    const t = e.touches[0];
    if (t) this.setHoverFromX(t.clientX, e.currentTarget as Element);
  }
  private setHoverFromX(clientX: number, el: Element): void {
    const n = this.labels().length;
    if (n < 2) return;
    const r = el.getBoundingClientRect();
    const i = Math.round(((clientX - r.left) / r.width) * (n - 1));
    this.hover.set(Math.max(0, Math.min(n - 1, i)));
  }

  protected eur(v: number): string {
    return formatEur(v);
  }
}
