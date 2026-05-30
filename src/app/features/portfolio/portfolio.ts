import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HoldingsRepository, InstrumentsRepository, TransactionsRepository } from '../../core/data';
import { formatEur, formatPercent, formatSignedEur } from '../../core/money/format';
import { Instrument } from '../../core/models';

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

@Component({
  selector: 'app-portfolio',
  imports: [RouterLink],
  template: `
    <section class="page">
      <header class="page-header row row-between">
        <div>
          <h1>Portafoglio</h1>
          <p class="subtitle">Posizioni, valore e P/L.</p>
        </div>
        <div class="row">
          <a class="btn btn-ghost" routerLink="/portfolio/movimenti">Movimenti</a>
          <a class="btn btn-primary" routerLink="/portfolio/transaction">+ Operazione</a>
        </div>
      </header>

      @if (rows().length) {
        <div class="grid summary">
          <div class="card sum">
            <span class="label">Valore portafoglio</span>
            <span class="num big">{{ eur(total()) }}</span>
            <span class="small" [class.gain]="plTotal() > 0" [class.loss]="plTotal() < 0">
              {{ signed(plTotal()) }} · {{ pct(plPctTotal()) }}
            </span>
          </div>
          <div class="card sum">
            <span class="label">Dividendi incassati</span>
            <span class="num big gain">{{ eur(dividends()) }}</span>
            <span class="muted small">{{ dividendCount() }} accrediti</span>
          </div>
        </div>

        <div class="card chart-card">
          <span class="label">Allocazione</span>
          <div class="pie-wrap">
            <svg viewBox="0 0 120 120" class="pie" aria-hidden="true">
              @for (s of slices(); track s.symbol) {
                <path [attr.d]="s.d" [attr.fill]="s.color" />
              }
            </svg>
            <ul class="legend">
              @for (s of slices(); track s.symbol) {
                <li>
                  <span class="dot" [style.background]="s.color"></span>
                  <span class="lsym">{{ s.symbol }}</span>
                  <span class="muted">{{ s.pct }}%</span>
                </li>
              }
            </ul>
          </div>
        </div>

        <div class="stack-sm">
          @for (r of rows(); track r.id) {
            <div class="card pos">
              <div class="pos-main">
                <div class="sym">{{ r.symbol }}</div>
                <div class="muted small">{{ r.qty }} × PMC {{ eur2(r.avgCost) }}</div>
              </div>
              <div class="pos-vals">
                <div class="num value">{{ eur(r.value) }}</div>
                <div class="num small" [class.gain]="r.pl > 0" [class.loss]="r.pl < 0">
                  {{ signed(r.pl) }} · {{ pct(r.plPct) }}
                </div>
              </div>
            </div>
          }
        </div>
        <p class="muted small note">
          Prezzi dall'ultimo aggiornamento importato; le posizioni nuove sono valorizzate al costo.
          Variazioni 1g/1m/1a e quotazioni live in arrivo con Finnhub.
        </p>
      } @else {
        <div class="card empty">
          <p class="secondary">
            Nessuna posizione. Aggiungi un'operazione con <strong>+ Operazione</strong>.
          </p>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .summary {
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        margin-bottom: var(--space-4);
      }
      .sum {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-5);
      }
      .big {
        font-size: 1.5rem;
        font-weight: var(--fw-bold);
      }
      .small {
        font-size: var(--fs-small);
      }
      .chart-card {
        margin-bottom: var(--space-4);
      }
      .pie-wrap {
        display: flex;
        align-items: center;
        gap: var(--space-6);
        flex-wrap: wrap;
        margin-top: var(--space-3);
      }
      .pie {
        width: 140px;
        height: 140px;
        flex: none;
      }
      .legend {
        list-style: none;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: var(--space-1) var(--space-4);
        flex: 1;
        min-width: 160px;
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
      .pos {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
      }
      .sym {
        font-weight: var(--fw-semibold);
      }
      .pos-vals {
        text-align: right;
      }
      .value {
        font-weight: var(--fw-semibold);
      }
      .note {
        margin-top: var(--space-4);
      }
      .empty {
        padding: var(--space-6);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortfolioPage {
  private readonly holdingsRepo = inject(HoldingsRepository);
  private readonly instrumentsRepo = inject(InstrumentsRepository);
  private readonly txRepo = inject(TransactionsRepository);

  private readonly holdings = this.holdingsRepo.connectAll();
  private readonly instruments = this.instrumentsRepo.connect();
  private readonly txs = this.txRepo.connectByDate();

  protected readonly rows = computed(() => {
    const byId = new Map<string, Instrument>(this.instruments().map((i) => [i.id ?? i.symbol, i]));
    return this.holdings()
      .map((h) => {
        const ins = byId.get(h.instrumentId);
        const price =
          h.priceMode === 'manual'
            ? (h.manualPrice ?? h.avgCost)
            : (ins?.lastPrice ?? ins?.manualPrice ?? h.avgCost);
        const value = h.quantity * price;
        const cost = h.quantity * h.avgCost;
        const pl = value - cost;
        return {
          id: h.id ?? h.instrumentId,
          symbol: ins?.symbol ?? h.instrumentId,
          qty: h.quantity,
          avgCost: h.avgCost,
          value,
          pl,
          plPct: cost ? pl / cost : 0,
        };
      })
      .sort((a, b) => b.value - a.value);
  });

  protected readonly total = computed(() => this.rows().reduce((s, r) => s + r.value, 0));
  protected readonly plTotal = computed(() => this.rows().reduce((s, r) => s + r.pl, 0));
  protected readonly plPctTotal = computed(() => {
    const cost = this.total() - this.plTotal();
    return cost ? this.plTotal() / cost : 0;
  });

  private readonly dividendTxs = computed(() => this.txs().filter((t) => t.type === 'dividend'));
  protected readonly dividends = computed(() =>
    this.dividendTxs().reduce((s, t) => s + t.amount, 0),
  );
  protected readonly dividendCount = computed(() => this.dividendTxs().length);

  protected readonly slices = computed(() => {
    const rows = this.rows().filter((r) => r.value > 0);
    const total = rows.reduce((s, r) => s + r.value, 0);
    if (total <= 0) return [];
    let a = -Math.PI / 2;
    return rows.map((r, i) => {
      const frac = r.value / total;
      const a0 = a;
      const a1 = a + frac * 2 * Math.PI;
      a = a1;
      return {
        symbol: r.symbol,
        color: PALETTE[i % PALETTE.length],
        pct: Math.round(frac * 100),
        d: arcPath(60, 60, 56, a0, a1),
      };
    });
  });

  protected eur(v: number): string {
    return formatEur(v);
  }
  protected eur2(v: number): string {
    return formatEur(v, { cents: true });
  }
  protected pct(fraction: number): string {
    return formatPercent(fraction);
  }
  protected signed(v: number): string {
    return formatSignedEur(v);
  }
}
