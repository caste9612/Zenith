import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { HoldingsRepository, InstrumentsRepository } from '../../core/data';
import { formatEur, formatPercent, formatSignedEur } from '../../core/money/format';
import { Instrument } from '../../core/models';

@Component({
  selector: 'app-portfolio',
  template: `
    <section class="page">
      <header class="page-header row row-between">
        <div>
          <h1>Portafoglio</h1>
          <p class="subtitle">Posizioni in titoli, valore e P/L.</p>
        </div>
        <button class="btn btn-ghost" type="button" disabled title="Quotazioni live in arrivo">
          Aggiorna
        </button>
      </header>

      @if (rows().length) {
        <div class="card total-card">
          <span class="label">Valore portafoglio</span>
          <span class="num total">{{ eur(total()) }}</span>
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
          Prezzi dall'ultimo aggiornamento importato. Le quotazioni live (refresh all'avvio +
          manuale) arrivano nel prossimo passo.
        </p>
      } @else {
        <div class="card empty">
          <p class="secondary">
            Nessuna posizione ancora. Dopo l'import vedrai qui le tue holding con valore e P/L.
          </p>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .total-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-5);
        margin-bottom: var(--space-4);
      }
      .total {
        font-size: 1.5rem;
        font-weight: var(--fw-bold);
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
      .small {
        font-size: var(--fs-small);
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

  private readonly holdings = this.holdingsRepo.connectAll();
  private readonly instruments = this.instrumentsRepo.connect();

  protected readonly rows = computed(() => {
    const byId = new Map<string, Instrument>(this.instruments().map((i) => [i.id ?? i.symbol, i]));
    return this.holdings()
      .map((h) => {
        const ins = byId.get(h.instrumentId);
        const price =
          h.priceMode === 'manual'
            ? (h.manualPrice ?? 0)
            : (ins?.lastPrice ?? ins?.manualPrice ?? 0);
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

  protected eur(v: number): string {
    return formatEur(v);
  }
  protected pct(fraction: number): string {
    return formatPercent(fraction);
  }
  protected eur2(v: number): string {
    return formatEur(v, { cents: true });
  }
  protected signed(v: number): string {
    return formatSignedEur(v);
  }
}
