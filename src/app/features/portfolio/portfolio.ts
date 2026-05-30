import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  HoldingsRepository,
  InstrumentsRepository,
  SnapshotsRepository,
  TransactionsRepository,
} from '../../core/data';
import { formatEur, formatPercent, formatSignedEur } from '../../core/money/format';
import { Instrument } from '../../core/models';
import { QuoteService } from '../../core/quotes/quote.service';
import { ChartPoint, ValueChartComponent } from '../../shared/value-chart';

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
const dtFmt = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number): [number, number] => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${cx} ${cy} L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

interface Variation {
  abs: number;
  pct: number;
}

@Component({
  selector: 'app-portfolio',
  imports: [RouterLink, ValueChartComponent],
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
        <div class="card hero">
          <div class="row row-between">
            <span class="label">Valore portafoglio</span>
            <button class="refresh" type="button" [disabled]="refreshing()" (click)="refresh()">
              {{ refreshing() ? 'Aggiornamento…' : '↻ Aggiorna' }}
            </button>
          </div>
          <div class="num big">{{ eur(total()) }}</div>

          <div class="vars">
            @for (v of variations(); track v.key) {
              <div class="vbox">
                <span class="vlabel">{{ v.key }}</span>
                @if (v.val) {
                  <span class="num vval" [class.gain]="v.val.abs > 0" [class.loss]="v.val.abs < 0">
                    {{ signed(v.val.abs) }}
                  </span>
                  <span class="num vpct muted">{{ pct(v.val.pct) }}</span>
                } @else {
                  <span class="muted">—</span>
                }
              </div>
            }
          </div>

          <div class="muted small upd">{{ lastUpdateLabel() }}</div>
        </div>

        <div class="card">
          <span class="label">Andamento valore</span>
          <app-value-chart [points]="series()" />
        </div>

        <div class="grid two">
          <div class="card">
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
          <div class="card sumcard">
            <div>
              <span class="label">P/L totale</span>
              <div class="num mid" [class.gain]="plTotal() > 0" [class.loss]="plTotal() < 0">
                {{ signed(plTotal()) }} · {{ pct(plPctTotal()) }}
              </div>
            </div>
            <div>
              <span class="label">Dividendi incassati</span>
              <div class="num mid gain">{{ eur(dividends()) }}</div>
              <span class="muted small">{{ dividendCount() }} accrediti</span>
            </div>
          </div>
        </div>

        <div class="stack-sm">
          @for (r of rows(); track r.id) {
            <a class="card pos" [routerLink]="['/portfolio/instrument', r.symbol]">
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
            </a>
          }
        </div>

        @if (failed().length) {
          <p class="muted small note">
            Quotazioni non disponibili (free tier) per: {{ failed().join(', ') }} — restano
            all'ultimo prezzo importato/manuale.
          </p>
        }
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
      .hero {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-5);
        margin-bottom: var(--space-4);
      }
      .big {
        font-size: 1.75rem;
        font-weight: var(--fw-bold);
      }
      .refresh {
        border: 1px solid var(--border-strong);
        background: var(--surface);
        color: var(--text-secondary);
        border-radius: var(--radius-pill);
        padding: var(--space-1) var(--space-3);
        font-size: var(--fs-label);
      }
      .refresh:hover:not(:disabled) {
        background: var(--surface-hover);
        color: var(--text);
      }
      .vars {
        display: flex;
        gap: var(--space-6);
        margin-top: var(--space-2);
      }
      .vbox {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .vlabel {
        font-size: var(--fs-small);
        color: var(--text-muted);
        text-transform: uppercase;
      }
      .vval {
        font-weight: var(--fw-semibold);
      }
      .vpct {
        font-size: var(--fs-small);
      }
      .upd {
        margin-top: var(--space-1);
      }
      .two {
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        margin: var(--space-4) 0;
      }
      .sumcard {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: var(--space-4);
      }
      .mid {
        font-size: 1.2rem;
        font-weight: var(--fw-semibold);
      }
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
        grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
        gap: var(--space-1) var(--space-3);
        flex: 1;
        min-width: 140px;
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
        color: inherit;
        text-decoration: none;
        transition: background var(--t-fast);
      }
      .pos:hover {
        background: var(--surface-hover);
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
  private readonly snapsRepo = inject(SnapshotsRepository);
  private readonly quotes = inject(QuoteService);

  private readonly holdings = this.holdingsRepo.connectAll();
  private readonly instruments = this.instrumentsRepo.connect();
  private readonly txs = this.txRepo.connectByDate();
  private readonly snaps = this.snapsRepo.connectByDate();

  protected readonly refreshing = signal(false);
  protected readonly failed = signal<string[]>([]);

  constructor() {
    void this.autoRefresh();
  }

  /** Refresh all'avvio se le quotazioni sono "stale" (vincolo: niente streaming). */
  private async autoRefresh(): Promise<void> {
    const insts = await this.instrumentsRepo.list();
    const freshest = insts.reduce((m, i) => Math.max(m, i.lastPriceAt?.getTime() ?? 0), 0);
    if (this.quotes.isStale(freshest ? new Date(freshest) : undefined, 720)) {
      await this.refresh();
    }
  }

  protected async refresh(): Promise<void> {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    try {
      const r = await this.quotes.refreshAll();
      this.failed.set(r.failed);
    } finally {
      this.refreshing.set(false);
    }
  }

  protected readonly rows = computed(() => {
    const byId = new Map<string, Instrument>(this.instruments().map((i) => [i.id ?? i.symbol, i]));
    return this.holdings()
      .map((h) => {
        const ins = byId.get(h.instrumentId);
        // prezzo corrente in EUR: lastPrice (auto convertito o manuale), poi manualPrice, poi costo
        const price = ins?.lastPrice ?? ins?.manualPrice ?? h.avgCost;
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

  // --- andamento valore (storico mensile dell'account "azionario") ---
  protected readonly series = computed<ChartPoint[]>(() =>
    this.snaps()
      .map((s) => ({ date: s.date, value: s.values['azionario'] ?? 0 }))
      .filter((p) => p.value > 0),
  );

  private variationBack(monthsBack: number): Variation | null {
    const s = this.series();
    if (s.length <= monthsBack) return null;
    const past = s[s.length - 1 - monthsBack].value;
    const now = this.total() || s[s.length - 1].value;
    return past ? { abs: now - past, pct: (now - past) / past } : null;
  }

  protected readonly var1d = computed<Variation | null>(() => {
    const byId = new Map<string, Instrument>(this.instruments().map((i) => [i.id ?? i.symbol, i]));
    let now = 0;
    let prev = 0;
    let has = false;
    for (const h of this.holdings()) {
      const ins = byId.get(h.instrumentId);
      if (ins?.lastPrice && ins?.prevClose) {
        now += h.quantity * ins.lastPrice;
        prev += h.quantity * ins.prevClose;
        has = true;
      }
    }
    return has && prev ? { abs: now - prev, pct: (now - prev) / prev } : null;
  });

  protected readonly variations = computed(() => [
    { key: '1 g', val: this.var1d() },
    { key: '1 m', val: this.variationBack(1) },
    { key: '1 a', val: this.variationBack(12) },
  ]);

  private readonly dividendTxs = computed(() => this.txs().filter((t) => t.type === 'dividend'));
  protected readonly dividends = computed(() =>
    this.dividendTxs().reduce((s, t) => s + t.amount, 0),
  );
  protected readonly dividendCount = computed(() => this.dividendTxs().length);

  protected readonly lastUpdateLabel = computed(() => {
    const t = this.instruments().reduce((m, i) => Math.max(m, i.lastPriceAt?.getTime() ?? 0), 0);
    return t ? `Quotazioni: ${dtFmt.format(new Date(t))}` : 'Quotazioni non ancora aggiornate';
  });

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
