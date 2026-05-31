import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PortfolioHistoryRepository } from '../../core/data';
import {
  formatEur,
  formatPercent,
  formatPercentPlain,
  formatSignedEur,
} from '../../core/money/format';
import { computeMetrics, RISK_FREE_ANNUAL } from '../../core/portfolio/metrics';
import { LineSeries, MultiLineChartComponent } from '../../shared/multi-line-chart';

const periodFmt = new Intl.DateTimeFormat('it-IT', { month: 'short', year: 'numeric' });
const ratioFmt = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COLORS = {
  invested: '#8a93a6',
  portfolio: '#3b5bdb',
  sp: '#f08c00',
  nasdaq: '#7048e8',
};

/**
 * Pagina "Rendimento": track record storico del portafoglio (dall'Excel) con confronto
 * vs benchmark S&P 500 / NASDAQ e scomposizione del rendimento (realizzato, dividendi,
 * non realizzato) — dati che la pagina Portafoglio (solo posizioni aperte) non mostra.
 */
@Component({
  selector: 'app-performance',
  imports: [RouterLink, MultiLineChartComponent],
  template: `
    <section class="page">
      <header class="page-header row row-between">
        <div>
          <h1>Rendimento</h1>
          <p class="subtitle">Storico del portafoglio e confronto con gli indici.</p>
        </div>
        <a class="btn btn-ghost" routerLink="/portfolio">Portafoglio</a>
      </header>

      @if (points().length >= 2) {
        <div class="hero card">
          <span class="label">Rendimento totale · {{ period() }}</span>
          <div
            class="hero-value num"
            [class.gain]="totalReturn() > 0"
            [class.loss]="totalReturn() < 0"
          >
            {{ signed(totalReturn()) }}
          </div>
          <div class="muted">
            {{ pct(totalReturnPct()) }} sul capitale investito ({{ eur(invested()) }})
          </div>
        </div>

        <div class="grid three">
          <div class="card mini">
            <span class="label">Realizzato</span>
            <span class="num value gain">{{ signed(realized()) }}</span>
            <span class="muted small">posizioni chiuse</span>
          </div>
          <div class="card mini">
            <span class="label">Dividendi</span>
            <span class="num value gain">{{ signed(dividends()) }}</span>
            <span class="muted small">incassati</span>
          </div>
          <div class="card mini">
            <span class="label">Non realizzato</span>
            <span class="num value" [class.gain]="openPL() > 0" [class.loss]="openPL() < 0">{{
              signed(openPL())
            }}</span>
            <span class="muted small">posizioni aperte</span>
          </div>
        </div>

        @if (metrics().months >= 2) {
          <h2 class="section-title">Indicatori</h2>
          <div class="grid four">
            <div class="card mini">
              <span class="label">Rendimento annuo</span>
              <span
                class="num value"
                [class.gain]="metrics().cagr > 0"
                [class.loss]="metrics().cagr < 0"
                >{{ pct(metrics().cagr) }}</span
              >
              <span class="muted small">CAGR composto</span>
            </div>
            <div class="card mini">
              <span class="label">Volatilità</span>
              <span class="num value">{{ pctPlain(metrics().volatility) }}</span>
              <span class="muted small">annualizzata</span>
            </div>
            <div class="card mini">
              <span class="label">Sharpe</span>
              <span
                class="num value"
                [class.gain]="metrics().sharpe > 0"
                [class.loss]="metrics().sharpe < 0"
                >{{ ratio(metrics().sharpe) }}</span
              >
              <span class="muted small">risk-free {{ pctPlain(riskFree) }}</span>
            </div>
            <div class="card mini">
              <span class="label">Max drawdown</span>
              <span class="num value loss">−{{ pctPlain(metrics().maxDrawdown) }}</span>
              <span class="muted small">caduta dal picco</span>
            </div>
          </div>
        }

        <div class="card">
          <span class="label">Portafoglio vs benchmark</span>
          <app-multi-line-chart [labels]="labels()" [series]="series()" />
        </div>

        <h2 class="section-title">Stesso investito, a {{ periodEnd() }}</h2>
        <div class="stack-sm">
          <div class="card cmp">
            <span class="dot" [style.background]="COLORS.portfolio"></span>
            <span class="cmp-name">Il tuo portafoglio</span>
            <span class="num value">{{ eur(last().value) }}</span>
          </div>
          @for (b of benchmarks(); track b.name) {
            <div class="card cmp">
              <span class="dot" [style.background]="b.color"></span>
              <span class="cmp-name">{{ b.name }}</span>
              <span class="num delta" [class.gain]="b.delta > 0" [class.loss]="b.delta < 0">{{
                signed(b.delta)
              }}</span>
              <span class="num value">{{ eur(b.value) }}</span>
            </div>
          }
          <p class="muted small note">
            Valore che avresti investendo lo stesso flusso netto (acquisti − vendite) nell'indice.
            Un segno − sul tuo confronto significa che l'indice ha reso di più.
          </p>
        </div>
      } @else {
        <div class="card empty">
          <p class="secondary">
            Nessuno storico ancora. Importa il track record dall'Excel con
            <code>npm run import:trackrecord</code>.
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
        gap: var(--space-1);
        padding: var(--space-6);
      }
      .hero-value {
        font-size: var(--fs-display);
        font-weight: var(--fw-bold);
        letter-spacing: -0.02em;
      }
      .three {
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        margin: var(--space-4) 0;
      }
      .four {
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        margin: var(--space-3) 0 var(--space-4);
      }
      .mini {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: var(--space-4);
      }
      .mini .value {
        font-size: 1.2rem;
        font-weight: var(--fw-semibold);
      }
      .small {
        font-size: var(--fs-small);
      }
      .section-title {
        margin: var(--space-6) 0 var(--space-3);
        font-size: var(--fs-h2);
      }
      .cmp {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
      }
      .cmp-name {
        flex: 1;
        font-weight: var(--fw-medium);
      }
      .cmp .delta {
        font-size: var(--fs-label);
        font-weight: var(--fw-semibold);
      }
      .cmp .value {
        font-weight: var(--fw-semibold);
        min-width: 90px;
        text-align: right;
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 3px;
        flex: none;
      }
      .note {
        margin-top: var(--space-2);
      }
      .empty {
        padding: var(--space-6);
      }
      code {
        background: var(--surface-2);
        padding: 1px 5px;
        border-radius: 5px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerformancePage {
  private readonly historyRepo = inject(PortfolioHistoryRepository);
  protected readonly points = this.historyRepo.connectByDate();
  protected readonly COLORS = COLORS;

  protected readonly last = computed(() => this.points().at(-1)!);
  protected readonly invested = computed(() => this.last()?.invested ?? 0);
  protected readonly realized = computed(() => this.last()?.realized ?? 0);
  protected readonly openPL = computed(
    () =>
      this.last()?.openPL ?? (this.last() ? this.last().value - (this.last().invested ?? 0) : 0),
  );
  protected readonly dividends = computed(() =>
    this.points().reduce((s, p) => s + (p.dividends ?? 0), 0),
  );
  protected readonly totalReturn = computed(
    () => this.realized() + this.dividends() + this.openPL(),
  );
  protected readonly totalReturnPct = computed(() =>
    this.invested() ? this.totalReturn() / this.invested() : 0,
  );

  /** Indicatori (CAGR, volatilità, Sharpe, max drawdown) dai rendimenti mensili time-weighted. */
  protected readonly metrics = computed(() => computeMetrics(this.points(), RISK_FREE_ANNUAL));
  protected readonly riskFree = RISK_FREE_ANNUAL;

  protected readonly period = computed(() => {
    const p = this.points();
    if (p.length < 2) return '';
    return `${periodFmt.format(p[0].date)} → ${periodFmt.format(p.at(-1)!.date)}`;
  });
  protected readonly periodEnd = computed(() => {
    const p = this.points();
    return p.length ? periodFmt.format(p.at(-1)!.date) : '';
  });

  protected readonly labels = computed(() => this.points().map((p) => p.date));
  protected readonly series = computed<LineSeries[]>(() => {
    const p = this.points();
    return [
      { name: 'Investito', color: COLORS.invested, values: p.map((x) => x.invested) },
      { name: 'Portafoglio', color: COLORS.portfolio, values: p.map((x) => x.value) },
      { name: 'S&P 500', color: COLORS.sp, values: p.map((x) => x.sp) },
      { name: 'NASDAQ', color: COLORS.nasdaq, values: p.map((x) => x.nasdaq) },
    ];
  });

  protected readonly benchmarks = computed(() => {
    const l = this.last();
    if (!l) return [];
    const out: { name: string; color: string; value: number; delta: number }[] = [];
    if (l.sp != null)
      out.push({ name: 'S&P 500', color: COLORS.sp, value: l.sp, delta: l.value - l.sp });
    if (l.nasdaq != null)
      out.push({
        name: 'NASDAQ',
        color: COLORS.nasdaq,
        value: l.nasdaq,
        delta: l.value - l.nasdaq,
      });
    return out;
  });

  protected eur(v: number): string {
    return formatEur(v);
  }
  protected signed(v: number): string {
    return formatSignedEur(v);
  }
  protected pct(v: number): string {
    return formatPercent(v);
  }
  protected pctPlain(v: number): string {
    return formatPercentPlain(v);
  }
  protected ratio(v: number): string {
    return ratioFmt.format(v);
  }
}
