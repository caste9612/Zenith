import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AccountsRepository, SnapshotsRepository } from '../../core/data';
import {
  formatCompactEur,
  formatEur,
  formatPercent,
  formatPercentPlain,
  formatSignedEur,
} from '../../core/money/format';
import { AssetClass, ASSET_CLASS_LABELS, Owner, OWNER_LABELS, OWNERS } from '../../core/models';
import {
  accountSeries,
  assetClassSeries,
  netWorthGrowthSeries,
  ownerSeries,
  totalsByAssetClass,
  totalsByOwner,
} from '../../core/balance/net-worth';
import { seriesMetrics } from '../../core/portfolio/metrics';
import { AllocationPieComponent, PieItem } from '../../shared/allocation-pie';
import { BarChartComponent } from '../../shared/bar-chart';
import { StackedAreaChartComponent, StackSeries } from '../../shared/stacked-area-chart';
import { ChartPoint, ValueChartComponent } from '../../shared/value-chart';

const monthFmt = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });

/** Colore stabile per classe di asset (coerente con la palette della torta). */
const CLASS_COLORS: Record<AssetClass, string> = {
  equity: '#3b5bdb',
  crypto: '#f59f00',
  pension: '#7048e8',
  cash: '#12b886',
  reserve: '#1098ad',
  emergency: '#e64980',
  realEstate: '#2f9e44',
  vehicle: '#e8590c',
  liability: '#e03131',
  other: '#868e96',
};

/** Colore per intestatario (allineato ai pallini della dashboard). */
const OWNER_COLORS: Record<Owner, string> = {
  antonio: '#3b5bdb',
  michela: '#12b886',
  shared: '#f08c00',
};

@Component({
  selector: 'app-dashboard',
  imports: [ValueChartComponent, AllocationPieComponent, StackedAreaChartComponent, BarChartComponent],
  template: `
    <section class="page">
      <header class="page-header">
        <h1>Dashboard</h1>
        <p class="subtitle">Patrimonio netto del nucleo e andamento storico.</p>
      </header>

      @if (latest(); as l) {
        <div class="hero card">
          <span class="label">Patrimonio netto · {{ monthLabel() }}</span>
          <div class="hero-value num">{{ eur(l.netWorth) }}</div>
          <div class="deltas">
            @if (deltaMonth() !== null) {
              <span class="num" [class.gain]="deltaMonth()! > 0" [class.loss]="deltaMonth()! < 0">{{
                signed(deltaMonth()!)
              }}</span>
              <span class="muted">nel mese</span>
            }
            @if (deltaYear() !== null) {
              <span
                class="num"
                [class.gain]="deltaYear()! > 0"
                [class.loss]="deltaYear()! < 0"
                style="margin-left:var(--space-4)"
                >{{ signed(deltaYear()!) }}</span
              >
              <span class="muted">12 mesi</span>
            }
          </div>
        </div>

        <div class="card">
          <span class="label">Andamento patrimonio</span>
          <app-value-chart [points]="series()" />
        </div>

        @if (nwMetrics().steps >= 2) {
          <h2 class="section-title">Indicatori</h2>
          <div class="grid metrics">
            <div class="card mini">
              <span class="label">Crescita annua</span>
              <span
                class="num value"
                [class.gain]="nwMetrics().cagr > 0"
                [class.loss]="nwMetrics().cagr < 0"
                >{{ pct(nwMetrics().cagr) }}</span
              >
              <span class="muted small">CAGR del patrimonio</span>
            </div>
            <div class="card mini">
              <span class="label">Volatilità</span>
              <span class="num value">{{ pctPlain(nwMetrics().volatility) }}</span>
              <span class="muted small">variazione mensile, annualizzata</span>
            </div>
            <div class="card mini">
              <span class="label">Max drawdown</span>
              <span class="num value loss">−{{ pctPlain(nwMetrics().maxDrawdown) }}</span>
              <span class="muted small">caduta dal picco</span>
            </div>
          </div>
        }

        <h2 class="section-title">Ripartizione</h2>
        <div class="card">
          <div class="row row-between chart-head">
            <span class="label">Composizione del patrimonio</span>
            <div class="segmented">
              @for (f of allocFilters; track f.value) {
                <button
                  type="button"
                  [class.active]="allocDim() === f.value"
                  (click)="allocDim.set(f.value)"
                >
                  {{ f.label }}
                </button>
              }
            </div>
          </div>
          <app-allocation-pie [items]="allocItems()" [valueFormat]="compactEur" />
        </div>

        @if (snapshots().length >= 2) {
          <h2 class="section-title">Tasso di risparmio</h2>
          <div class="card">
            <div class="row row-between chart-head">
              <div class="segmented">
                @for (f of savingFilters; track f.value) {
                  <button
                    type="button"
                    [class.active]="savingOwner() === f.value"
                    (click)="savingOwner.set(f.value)"
                  >
                    {{ f.label }}
                  </button>
                }
              </div>
              <div class="row controls">
                <div class="segmented">
                  <button
                    type="button"
                    [class.active]="savingMetric() === 'pct'"
                    (click)="savingMetric.set('pct')"
                  >
                    %
                  </button>
                  <button
                    type="button"
                    [class.active]="savingMetric() === 'eur'"
                    (click)="savingMetric.set('eur')"
                  >
                    €
                  </button>
                </div>
                <select class="select" aria-label="Filtra per anno" (change)="setSavingYear($event)">
                  <option value="all" [selected]="savingYear() === 'all'">Tutti gli anni</option>
                  @for (y of savingYears(); track y) {
                    <option [value]="y" [selected]="savingYear() === y">{{ y }}</option>
                  }
                </select>
              </div>
            </div>
            @defer (on viewport) {
              <app-bar-chart
                [labels]="savingSeries().labels"
                [values]="savingSeries().values"
                [format]="savingMetric() === 'eur' ? 'eur' : 'percent'"
              />
            } @placeholder {
              <div class="chart-ph"></div>
            }
          </div>

          <h2 class="section-title">Composizione nel tempo</h2>
          <div class="card">
            <div class="row row-between chart-head">
              <div class="segmented">
                <button
                  type="button"
                  [class.active]="composeMode() === 'class'"
                  (click)="composeMode.set('class')"
                >
                  Per classe
                </button>
                <button
                  type="button"
                  [class.active]="composeMode() === 'owner'"
                  (click)="composeMode.set('owner')"
                >
                  Per intestatario
                </button>
              </div>
              @if (composeMode() === 'class') {
                <div class="segmented">
                  @for (f of ownerFilters; track f.value) {
                    <button
                      type="button"
                      [class.active]="classOwner() === f.value"
                      (click)="classOwner.set(f.value)"
                    >
                      {{ f.label }}
                    </button>
                  }
                </div>
              }
            </div>
            @defer (on viewport) {
              <app-stacked-area-chart
                [labels]="composeStacks().labels"
                [series]="composeStacks().series"
              />
            } @placeholder {
              <div class="chart-ph"></div>
            }
          </div>

          <h2 class="section-title">Andamento di una voce</h2>
          <div class="card">
            <select class="select" (change)="selectAccount($event)" aria-label="Scegli la voce">
              @for (o of accountOptions(); track o.id) {
                <option [value]="o.id" [selected]="o.id === effectiveAccountId()">
                  {{ o.name }}
                </option>
              }
            </select>
            @defer (on viewport) {
              <app-value-chart [points]="accountChart()" />
            } @placeholder {
              <div class="chart-ph"></div>
            }
          </div>
        }
      } @else {
        <div class="card empty">
          <p class="secondary">
            Nessun dato ancora. Dopo l'import dello storico vedrai qui il patrimonio netto, la
            variazione e l'andamento nel tempo.
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
        padding: var(--space-6);
      }
      .hero-value {
        font-size: var(--fs-display);
        font-weight: var(--fw-bold);
        letter-spacing: -0.02em;
      }
      .deltas {
        display: flex;
        align-items: baseline;
        gap: var(--space-1);
        font-size: var(--fs-label);
      }
      .deltas .num {
        font-weight: var(--fw-semibold);
      }
      .owners,
      .metrics {
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      }
      .mini {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-4);
      }
      .mini .value {
        font-size: 1.15rem;
        font-weight: var(--fw-semibold);
      }
      .voce {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
      }
      .voce-name {
        flex: 1;
        min-width: 0;
      }
      .voce .value {
        font-weight: var(--fw-semibold);
      }
      .small {
        font-size: var(--fs-small);
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--text-muted);
        flex: none;
      }
      .dot[data-owner='antonio'] {
        background: var(--accent);
      }
      .dot[data-owner='michela'] {
        background: #12b886;
      }
      .dot[data-owner='shared'] {
        background: #f08c00;
      }
      .empty {
        padding: var(--space-6);
      }
      .select {
        margin-bottom: var(--space-3);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm, 6px);
        background: var(--surface-2);
        color: var(--text);
        font: inherit;
      }
      .controls {
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .controls .select {
        margin-bottom: 0;
      }
      .chart-ph {
        height: 200px;
      }
      .chart-head {
        margin-bottom: var(--space-2);
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .segmented {
        display: inline-flex;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        overflow: hidden;
      }
      .segmented button {
        padding: 3px 10px;
        font-size: var(--fs-small);
        background: transparent;
        color: var(--text-secondary);
        border: none;
        border-left: 1px solid var(--border);
      }
      .segmented button:first-child {
        border-left: none;
      }
      .segmented button.active {
        background: var(--accent);
        color: var(--on-accent);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly accountsRepo = inject(AccountsRepository);
  private readonly snapshotsRepo = inject(SnapshotsRepository);

  // Letture in tempo reale (Firestore onSnapshot → Signal).
  protected readonly accounts = this.accountsRepo.connectOrdered();
  protected readonly snapshots = this.snapshotsRepo.connectByDate();

  protected readonly latest = computed(() => this.snapshots().at(-1) ?? null);

  protected readonly deltaMonth = computed<number | null>(() => {
    const s = this.snapshots();
    return s.length >= 2 ? s[s.length - 1].netWorth - s[s.length - 2].netWorth : null;
  });

  protected readonly deltaYear = computed<number | null>(() => {
    const s = this.snapshots();
    return s.length >= 13 ? s[s.length - 1].netWorth - s[s.length - 13].netWorth : null;
  });

  protected readonly ownerTotals = computed(() => {
    const l = this.latest();
    if (!l) return [];
    const totals = totalsByOwner(this.accounts(), l.values);
    return OWNERS.filter((o) => totals.has(o)).map((o) => ({
      owner: o,
      label: OWNER_LABELS[o],
      total: totals.get(o) ?? 0,
    }));
  });

  protected readonly breakdown = computed(() => {
    const l = this.latest();
    if (!l) return [];
    const total = l.netWorth || 1;
    return this.accounts()
      .map((a) => ({
        id: a.id ?? a.name,
        name: a.name,
        owner: a.owner,
        value: l.values[a.id ?? ''] ?? 0,
      }))
      .filter((b) => b.value !== 0)
      .sort((x, y) => y.value - x.value)
      .map((b) => ({ ...b, pct: Math.round((b.value / total) * 100) }));
  });

  protected readonly series = computed<ChartPoint[]>(() =>
    this.snapshots().map((s) => ({ date: s.date, value: s.netWorth })),
  );

  /** Indicatori di crescita del patrimonio (CAGR, volatilità, max drawdown) dalla serie del netto. */
  protected readonly nwMetrics = computed(() =>
    seriesMetrics(this.snapshots().map((s) => s.netWorth)),
  );

  /** Ripartizione del patrimonio per classe di asset (solo voci attive, escluse le passività). */
  protected readonly byClass = computed<PieItem[]>(() => {
    const l = this.latest();
    if (!l) return [];
    return [...totalsByAssetClass(this.accounts(), l.values, { assetsOnly: true }).entries()]
      .map(([cls, value]) => ({ label: ASSET_CLASS_LABELS[cls], value }))
      .sort((x, y) => y.value - x.value);
  });

  /** Ripartizione per intestatario (solo netti positivi), per la torta unificata. */
  protected readonly byOwner = computed<PieItem[]>(() => {
    const l = this.latest();
    if (!l) return [];
    return [...totalsByOwner(this.accounts(), l.values).entries()]
      .map(([o, value]) => ({ label: OWNER_LABELS[o], value }))
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value);
  });

  /** Ripartizione per singola voce (solo valori positivi), per la torta unificata. */
  protected readonly byAccount = computed<PieItem[]>(() => {
    const l = this.latest();
    if (!l) return [];
    return this.accounts()
      .map((a) => ({ label: a.name, value: l.values[a.id ?? ''] ?? 0 }))
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value);
  });

  /** Ripartizione UNIFICATA: una sola torta con dimensione classe / voce / intestatario. */
  protected readonly allocDim = signal<'class' | 'account' | 'owner'>('class');
  protected readonly allocFilters: { value: 'class' | 'account' | 'owner'; label: string }[] = [
    { value: 'class', label: 'Classe' },
    { value: 'account', label: 'Voce' },
    { value: 'owner', label: 'Intestatario' },
  ];
  protected readonly allocItems = computed<PieItem[]>(() => {
    const d = this.allocDim();
    return d === 'owner' ? this.byOwner() : d === 'account' ? this.byAccount() : this.byClass();
  });
  /** Formatter € compatto per la legenda della torta. */
  protected readonly compactEur = formatCompactEur;

  /** Filtro intestatario per la composizione per classe (Tutti / Antonio / Michela / Condiviso). */
  protected readonly classOwner = signal<'all' | Owner>('all');
  protected readonly ownerFilters: { value: 'all' | Owner; label: string }[] = [
    { value: 'all', label: 'Tutti' },
    { value: 'antonio', label: 'Antonio' },
    { value: 'michela', label: 'Michela' },
    { value: 'shared', label: 'Condiviso' },
  ];
  private readonly classAccounts = computed(() => {
    const o = this.classOwner();
    return o === 'all' ? this.accounts() : this.accounts().filter((a) => a.owner === o);
  });

  /** Composizione del patrimonio per classe di asset nel tempo (ordine: classe più grande in basso). */
  protected readonly classStacks = computed<{ labels: Date[]; series: StackSeries[] }>(() => {
    const { labels, byKey } = assetClassSeries(this.classAccounts(), this.snapshots());
    const series = [...byKey.entries()]
      .sort((a, b) => (b[1].at(-1) ?? 0) - (a[1].at(-1) ?? 0))
      .map(([cls, values]) => ({
        name: ASSET_CLASS_LABELS[cls],
        color: CLASS_COLORS[cls] ?? CLASS_COLORS.other,
        values,
      }));
    return { labels, series };
  });

  /** Patrimonio per intestatario nel tempo. */
  protected readonly ownerStacks = computed<{ labels: Date[]; series: StackSeries[] }>(() => {
    const { labels, byKey } = ownerSeries(this.accounts(), this.snapshots());
    const series = OWNERS.filter((o) => byKey.has(o)).map((o) => ({
      name: OWNER_LABELS[o],
      color: OWNER_COLORS[o],
      values: byKey.get(o)!,
    }));
    return { labels, series };
  });

  /**
   * Tasso di risparmio = crescita % del patrimonio netto mese su mese (per intestatario o nucleo).
   * Basato sul patrimonio, così un trasferimento tra conti non appare come spesa.
   */
  protected readonly savingOwner = signal<'all' | Owner>('all');
  protected readonly savingFilters: { value: 'all' | Owner; label: string }[] = [
    { value: 'all', label: 'Nucleo' },
    { value: 'antonio', label: 'Antonio' },
    { value: 'michela', label: 'Michela' },
  ];
  protected readonly savingRate = computed(() => {
    const o = this.savingOwner();
    return netWorthGrowthSeries(this.accounts(), this.snapshots(), o === 'all' ? undefined : o);
  });

  /** Metrica del tasso: percentuale o valore assoluto in €. */
  protected readonly savingMetric = signal<'pct' | 'eur'>('pct');
  /** Filtro anno per il tasso (tutti gli anni o uno specifico). */
  protected readonly savingYear = signal<number | 'all'>('all');
  protected readonly savingYears = computed(() =>
    [...new Set(this.snapshots().map((s) => s.date.getFullYear()))].sort((a, b) => b - a),
  );
  /** Serie del tasso, filtrata per anno e nella metrica scelta (% o € assoluto). */
  protected readonly savingSeries = computed<{ labels: Date[]; values: (number | null)[] }>(() => {
    const full = this.savingRate();
    const eur = this.savingMetric() === 'eur';
    const year = this.savingYear();
    const labels: Date[] = [];
    const values: (number | null)[] = [];
    full.labels.forEach((d, i) => {
      if (year !== 'all' && d.getFullYear() !== year) return;
      labels.push(d);
      values.push(eur ? full.deltas[i] : full.values[i]);
    });
    return { labels, values };
  });

  /**
   * Composizione nel tempo UNIFICATA: un solo grafico ad area con toggle della dimensione
   * (per classe di asset / per intestatario), invece di due grafici quasi identici.
   */
  protected readonly composeMode = signal<'class' | 'owner'>('class');
  protected readonly composeStacks = computed(() =>
    this.composeMode() === 'owner' ? this.ownerStacks() : this.classStacks(),
  );

  /** Voci selezionabili per il drill (tutte le voci attive). */
  protected readonly accountOptions = computed(() =>
    this.accounts().map((a) => ({ id: a.id ?? a.name, name: a.name })),
  );
  protected readonly selectedAccountId = signal<string>('');
  /** Voce effettiva mostrata: quella scelta o, se nessuna, la prima dell'elenco. */
  protected readonly effectiveAccountId = computed(
    () => this.selectedAccountId() || this.accountOptions()[0]?.id || '',
  );
  protected readonly accountChart = computed<ChartPoint[]>(() => {
    const id = this.effectiveAccountId();
    return id ? accountSeries(id, this.snapshots()) : [];
  });

  protected selectAccount(e: Event): void {
    this.selectedAccountId.set((e.target as HTMLSelectElement).value);
  }

  protected setSavingYear(e: Event): void {
    const v = (e.target as HTMLSelectElement).value;
    this.savingYear.set(v === 'all' ? 'all' : Number(v));
  }

  protected monthLabel(): string {
    const l = this.latest();
    return l ? monthFmt.format(l.date) : '';
  }

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
  protected ownerLabel(o: Owner): string {
    return OWNER_LABELS[o];
  }
}
