import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { formatEur } from '../core/money/format';

export interface LineSeries {
  name: string;
  color: string;
  /** Valori allineati a `labels` (stesso indice). null = punto mancante. */
  values: (number | null)[];
}

const dateFmt = new Intl.DateTimeFormat('it-IT', { month: 'short', year: 'numeric' });

/**
 * Grafico multi-linea interattivo (SVG, zero dipendenze). Più serie su un asse x condiviso
 * (mesi). Al passaggio di mouse/dito mostra il mese e il valore di ogni serie. Usato nella
 * pagina Rendimento per confrontare il portafoglio con i benchmark.
 */
@Component({
  selector: 'app-multi-line-chart',
  template: `
    @if (labels().length >= 2) {
      <div class="readout">
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
        @for (s of geo(); track s.name) {
          <path [attr.d]="s.path" class="line" [style.stroke]="s.color" />
        }
        @if (markerX() !== null) {
          <line [attr.x1]="markerX()" [attr.x2]="markerX()" y1="0" [attr.y2]="H" class="vline" />
          @for (s of geo(); track s.name) {
            @if (s.coords[activeIndex()]; as c) {
              <circle [attr.cx]="c.x" [attr.cy]="c.y" r="3.5" [style.fill]="s.color" />
            }
          }
        }
      </svg>
      <ul class="legend">
        @for (s of seriesWithActive(); track s.name) {
          <li>
            <span class="dot" [style.background]="s.color"></span>
            <span class="lname">{{ s.name }}</span>
            <span class="num lval">{{ s.active === null ? '—' : eur(s.active) }}</span>
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
        margin-bottom: var(--space-1);
      }
      .date {
        font-size: var(--fs-label);
        text-transform: capitalize;
        font-weight: var(--fw-medium);
      }
      .svg {
        width: 100%;
        height: 200px;
        overflow: visible;
        touch-action: none;
        cursor: crosshair;
      }
      .line {
        fill: none;
        stroke-width: 2;
        vector-effect: non-scaling-stroke;
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
export class MultiLineChartComponent {
  readonly labels = input<Date[]>([]);
  readonly series = input<LineSeries[]>([]);

  protected readonly W = 600;
  protected readonly H = 200;
  protected readonly hover = signal<number | null>(null);

  private readonly bounds = computed(() => {
    const all: number[] = [];
    for (const s of this.series())
      for (const v of s.values) if (v !== null && Number.isFinite(v)) all.push(v);
    if (!all.length) return null;
    const min = Math.min(...all);
    const max = Math.max(...all);
    return { min, range: max - min || 1 };
  });

  protected readonly geo = computed(() => {
    const b = this.bounds();
    const n = this.labels().length;
    const pad = 6;
    if (!b || n < 2)
      return [] as {
        name: string;
        color: string;
        path: string;
        coords: ({ x: number; y: number } | null)[];
      }[];
    const xAt = (i: number) => pad + (i / (n - 1)) * (this.W - 2 * pad);
    const yAt = (v: number) => pad + (1 - (v - b.min) / b.range) * (this.H - 2 * pad);
    return this.series().map((s) => {
      const coords = s.values.map((v, i) =>
        v === null || !Number.isFinite(v) ? null : { x: xAt(i), y: yAt(v) },
      );
      let path = '';
      let pen = false;
      for (const c of coords) {
        if (!c) {
          pen = false;
          continue;
        }
        path += `${pen ? 'L' : 'M'}${c.x.toFixed(1)} ${c.y.toFixed(1)} `;
        pen = true;
      }
      return { name: s.name, color: s.color, path: path.trim(), coords };
    });
  });

  protected readonly activeIndex = computed(() => this.hover() ?? this.labels().length - 1);

  protected readonly activeDate = computed(() => {
    const d = this.labels()[this.activeIndex()];
    return d ? dateFmt.format(d) : '';
  });

  protected readonly markerX = computed<number | null>(() => {
    if (this.hover() === null) return null;
    const g = this.geo();
    for (const s of g) {
      const c = s.coords[this.activeIndex()];
      if (c) return c.x;
    }
    return null;
  });

  protected readonly seriesWithActive = computed(() => {
    const i = this.activeIndex();
    return this.series().map((s) => ({
      name: s.name,
      color: s.color,
      active: s.values[i] ?? null,
    }));
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
    if (n < 2) return;
    const r = el.getBoundingClientRect();
    const i = Math.round(((clientX - r.left) / r.width) * (n - 1));
    this.hover.set(Math.max(0, Math.min(n - 1, i)));
  }

  protected eur(v: number): string {
    return formatEur(v);
  }
}
