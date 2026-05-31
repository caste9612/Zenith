import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InstrumentsRepository, TransactionsRepository } from '../../core/data';
import { formatEur } from '../../core/money/format';
import { Transaction, TRANSACTION_TYPE_LABELS } from '../../core/models';
import { PortfolioService } from '../../core/portfolio/portfolio.service';

const dateFmt = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

@Component({
  selector: 'app-movements',
  imports: [RouterLink],
  template: `
    <section class="page">
      <header class="page-header row row-between">
        <div>
          <h1>Movimenti</h1>
          <p class="subtitle">Acquisti, vendite e dividendi.</p>
        </div>
        <a class="btn btn-primary" routerLink="/portfolio/transaction">+ Operazione</a>
      </header>

      @if (rows().length) {
        <div class="stack-sm">
          @for (r of rows(); track r.id) {
            <div class="card mov">
              <span class="kind" [attr.data-type]="r.type">{{ r.typeLabel }}</span>
              <div class="mov-main">
                <div class="sym">{{ r.symbol }}</div>
                <div class="muted small">{{ r.date }}{{ r.detail }}</div>
              </div>
              <span class="num amount" [class.gain]="r.type === 'sell' || r.type === 'dividend'">
                {{ r.type === 'sell' || r.type === 'dividend' ? '+' : '−' }}{{ eur(r.amount) }}
              </span>
              <button
                class="del"
                type="button"
                title="Elimina"
                [disabled]="busyId() === r.id"
                (click)="del(r.tx)"
              >
                ✕
              </button>
            </div>
          }
        </div>
      } @else {
        <div class="card empty">
          <p class="secondary">Nessun movimento. Aggiungi un'operazione dal pulsante qui sopra.</p>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .mov {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
      }
      .kind {
        font-size: var(--fs-small);
        font-weight: var(--fw-semibold);
        padding: 2px var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--surface-2);
        color: var(--text-secondary);
        flex: none;
        min-width: 72px;
        text-align: center;
      }
      .kind[data-type='buy'] {
        background: var(--accent-soft);
        color: var(--accent);
      }
      .kind[data-type='sell'] {
        background: var(--negative-soft);
        color: var(--negative);
      }
      .kind[data-type='dividend'] {
        background: var(--positive-soft);
        color: var(--positive);
      }
      .mov-main {
        flex: 1;
        min-width: 0;
      }
      .sym {
        font-weight: var(--fw-semibold);
      }
      .small {
        font-size: var(--fs-small);
      }
      .amount {
        font-weight: var(--fw-semibold);
      }
      .del {
        border: 0;
        background: transparent;
        color: var(--text-muted);
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-sm);
        font-size: 0.9rem;
      }
      .del:hover {
        background: var(--negative-soft);
        color: var(--negative);
      }
      .empty {
        padding: var(--space-6);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementsPage {
  private readonly txRepo = inject(TransactionsRepository);
  private readonly instrumentsRepo = inject(InstrumentsRepository);
  private readonly portfolio = inject(PortfolioService);

  private readonly txs = this.txRepo.connectByDate();
  private readonly instruments = this.instrumentsRepo.connect();
  protected readonly busyId = signal<string | null>(null);

  protected readonly rows = computed(() => {
    const sym = new Map(this.instruments().map((i) => [i.id ?? i.symbol, i.symbol]));
    return this.txs().map((t) => {
      const isTrade = t.type === 'buy' || t.type === 'sell';
      const detail =
        isTrade && t.quantity
          ? ` · ${t.quantity} × ${formatEur(t.price ?? 0, { cents: true })}`
          : '';
      return {
        tx: t,
        id: t.id ?? '',
        date: dateFmt.format(t.date),
        detail,
        type: t.type,
        typeLabel: TRANSACTION_TYPE_LABELS[t.type],
        symbol:
          sym.get(t.instrumentId ?? '') ??
          t.instrumentId ??
          (t.type === 'dividend' ? 'Dividendi' : '—'),
        amount: t.amount,
      };
    });
  });

  protected eur(v: number): string {
    return formatEur(v, { cents: true });
  }

  protected async del(tx: Transaction): Promise<void> {
    if (!tx.id || this.busyId()) return;
    this.busyId.set(tx.id);
    try {
      await this.portfolio.deleteTransaction(tx);
    } finally {
      this.busyId.set(null);
    }
  }
}
