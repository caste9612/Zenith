import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CashFlowRepository } from '../../core/data';
import { annualSummary, cumulativeSaved, savingRate } from '../../core/cashflow/cashflow';
import { formatEur, formatPercentPlain, formatSignedEur } from '../../core/money/format';
import { BarChartComponent } from '../../shared/bar-chart';
import { LineSeries, MultiLineChartComponent } from '../../shared/multi-line-chart';
import { ChartPoint, ValueChartComponent } from '../../shared/value-chart';

const periodFmt = new Intl.DateTimeFormat('it-IT', { month: 'short', year: 'numeric' });
const COLORS = { income: '#1f9d57', expenses: '#e8590c' };

/**
 * Pagina "Cash flow": entrate/uscite/risparmio del nucleo mese per mese (dati dal foglio CashFlow
 * dell'Excel, collezione `cashFlow`). Dati di nucleo, non divisi per intestatario.
 */
@Component({
  selector: 'app-cashflow',
  imports: [MultiLineChartComponent, BarChartComponent, ValueChartComponent],
  template: `
    <section class="page">
      <header class="page-header">
        <h1>Cash flow</h1>
        <p class="subtitle">Entrate, uscite e risparmio del nucleo, mese per mese.</p>
      </header>

      @if (months().length >= 2) {
        <div class="grid three">
          <div class="card mini">
            <span class="label">Risparmio totale</span>
            <span
              class="num value"
              [class.gain]="totalSaved() > 0"
              [class.loss]="totalSaved() < 0"
              >{{ signed(totalSaved()) }}</span
            >
            <span class="muted small">{{ period() }}</span>
          </div>
          <div class="card mini">
            <span class="label">Tasso di risparmio medio</span>
            <span class="num value">{{ pctPlain(avgRate()) }}</span>
            <span class="muted small">risparmio / entrate</span>
          </div>
          <div class="card mini">
            <span class="label">Entrate · uscite</span>
            <span class="num value">{{ eur(totalIncome()) }}</span>
            <span class="muted small">uscite {{ eur(totalExpenses()) }}</span>
          </div>
        </div>

        <h2 class="section-title">Entrate vs uscite</h2>
        <div class="card">
          @defer (on viewport) {
            <app-multi-line-chart [labels]="labels()" [series]="inOutSeries()" />
          } @placeholder {
            <div class="ph"></div>
          }
        </div>

        <h2 class="section-title">Risparmio mensile</h2>
        <div class="card">
          @defer (on viewport) {
            <app-bar-chart [labels]="labels()" [values]="savedValues()" format="eur" />
          } @placeholder {
            <div class="ph"></div>
          }
        </div>

        <h2 class="section-title">Tasso di risparmio</h2>
        <div class="card">
          @defer (on viewport) {
            <app-bar-chart [labels]="labels()" [values]="rateValues()" format="percent" />
          } @placeholder {
            <div class="ph"></div>
          }
        </div>

        <h2 class="section-title">Risparmio cumulato</h2>
        <div class="card">
          @defer (on viewport) {
            <app-value-chart [points]="cumulative()" />
          } @placeholder {
            <div class="ph"></div>
          }
        </div>

        <h2 class="section-title">Per anno</h2>
        <div class="stack-sm">
          @for (y of years(); track y.year) {
            <div class="card year">
              <span class="y-name num">{{ y.year }}</span>
              <span class="muted small"
                >netto {{ eur(y.income) }} · uscite {{ eur(y.expenses) }}</span
              >
              <span class="spacer"></span>
              @if (y.rate !== null) {
                <span class="muted small rate">{{ pctPlain(y.rate) }}</span>
              }
              <span class="num value" [class.gain]="y.saved > 0" [class.loss]="y.saved < 0">{{
                signed(y.saved)
              }}</span>
            </div>
          }
        </div>
      } @else {
        <div class="card empty">
          <p class="secondary">
            Nessun dato di cash flow. Importa con <code>npm run import:cashflow</code> (richiede
            <code>SEED_*</code> in <code>.env</code>).
          </p>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .three {
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
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
      .ph {
        height: 180px;
      }
      .year {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
      }
      .y-name {
        font-weight: var(--fw-semibold);
        min-width: 48px;
      }
      .year .rate {
        min-width: 56px;
        text-align: right;
      }
      .year .value {
        font-weight: var(--fw-semibold);
        min-width: 90px;
        text-align: right;
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
export class CashFlowPage {
  private readonly repo = inject(CashFlowRepository);
  protected readonly months = this.repo.connectByDate();

  protected readonly labels = computed(() => this.months().map((m) => m.date));
  protected readonly totalSaved = computed(() =>
    this.months().reduce((s, m) => s + (m.saved ?? 0), 0),
  );
  protected readonly totalIncome = computed(() =>
    this.months().reduce((s, m) => s + (m.income ?? 0), 0),
  );
  protected readonly totalExpenses = computed(() =>
    this.months().reduce((s, m) => s + (m.expenses ?? 0), 0),
  );
  protected readonly avgRate = computed(() => {
    const i = this.totalIncome();
    return i > 0 ? this.totalSaved() / i : 0;
  });

  protected readonly inOutSeries = computed<LineSeries[]>(() => [
    { name: 'Entrate', color: COLORS.income, values: this.months().map((m) => m.income) },
    { name: 'Uscite', color: COLORS.expenses, values: this.months().map((m) => m.expenses) },
  ]);
  protected readonly savedValues = computed(() => this.months().map((m) => m.saved));
  protected readonly rateValues = computed(() => this.months().map((m) => savingRate(m)));
  protected readonly cumulative = computed<ChartPoint[]>(() => cumulativeSaved(this.months()));
  protected readonly years = computed(() => annualSummary(this.months()));

  protected readonly period = computed(() => {
    const m = this.months();
    return m.length >= 2
      ? `${periodFmt.format(m[0].date)} → ${periodFmt.format(m.at(-1)!.date)}`
      : '';
  });

  protected eur(v: number): string {
    return formatEur(v);
  }
  protected signed(v: number): string {
    return formatSignedEur(v);
  }
  protected pctPlain(v: number): string {
    return formatPercentPlain(v);
  }
}
