import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface PieItem {
  label: string;
  value: number;
}

const PALETTE = [
  '#3b5bdb',
  '#12b886',
  '#f08c00',
  '#e8590c',
  '#7048e8',
  '#1098ad',
  '#e64980',
  '#2f9e44',
  '#f59f00',
  '#4263eb',
];

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number): [number, number] => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${cx} ${cy} L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

/** Grafico a torta con legenda (SVG, zero dipendenze). Riusabile (per classe, per titolo…). */
@Component({
  selector: 'app-allocation-pie',
  template: `
    @if (slices().length) {
      <div class="pie-wrap">
        <svg viewBox="0 0 120 120" class="pie" aria-hidden="true">
          @for (s of slices(); track s.label) {
            <path [attr.d]="s.d" [attr.fill]="s.color" />
          }
        </svg>
        <ul class="legend">
          @for (s of slices(); track s.label) {
            <li>
              <span class="dot" [style.background]="s.color"></span>
              <span class="lsym">{{ s.label }}</span>
              <span class="muted">{{ s.pct }}%</span>
            </li>
          }
        </ul>
      </div>
    } @else {
      <p class="muted">Nessun dato.</p>
    }
  `,
  styles: [
    `
      .pie-wrap {
        display: flex;
        align-items: center;
        gap: var(--space-5);
        flex-wrap: wrap;
        margin-top: var(--space-3);
      }
      .pie {
        width: 120px;
        height: 120px;
        flex: none;
      }
      .legend {
        list-style: none;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: var(--space-1) var(--space-3);
        flex: 1;
        min-width: 150px;
      }
      .legend li {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--fs-label);
      }
      .legend .lsym {
        font-weight: var(--fw-medium);
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
export class AllocationPieComponent {
  readonly items = input<PieItem[]>([]);

  protected readonly slices = computed(() => {
    const items = this.items().filter((i) => i.value > 0);
    const total = items.reduce((s, i) => s + i.value, 0);
    if (total <= 0) return [];
    let a = -Math.PI / 2;
    return items.map((it, i) => {
      const f = it.value / total;
      const a0 = a;
      const a1 = a + f * 2 * Math.PI;
      a = a1;
      return {
        label: it.label,
        color: PALETTE[i % PALETTE.length],
        pct: Math.round(f * 100),
        d: arcPath(60, 60, 56, a0, a1),
      };
    });
  });
}
