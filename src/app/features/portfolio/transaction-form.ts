import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InstrumentsRepository } from '../../core/data';
import { formatEur } from '../../core/money/format';
import { Instrument } from '../../core/models';
import { PortfolioService } from '../../core/portfolio/portfolio.service';

type TxKind = 'buy' | 'sell' | 'dividend';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`); // mezzogiorno UTC, niente shift di fuso
}

@Component({
  selector: 'app-transaction-form',
  imports: [RouterLink],
  template: `
    <section class="page">
      <header class="page-header">
        <h1>{{ locked ? symbol() : 'Aggiungi titolo' }}</h1>
        <p class="subtitle">
          {{
            locked
              ? 'Registra un acquisto, una vendita o un dividendo.'
              : 'Nuovo titolo: inserisci il simbolo e il primo acquisto.'
          }}
        </p>
      </header>

      <div class="segmented">
        <button type="button" [class.active]="type() === 'buy'" (click)="type.set('buy')">
          Acquisto
        </button>
        <button type="button" [class.active]="type() === 'sell'" (click)="type.set('sell')">
          Vendita
        </button>
        <button type="button" [class.active]="type() === 'dividend'" (click)="type.set('dividend')">
          Dividendo
        </button>
      </div>

      <div class="card stack-sm form">
        @if (!locked) {
          <label class="field">
            <span class="label">Simbolo</span>
            <input
              list="instr-list"
              [value]="symbol()"
              (input)="setSymbol($event)"
              placeholder="Es. ACOMO"
              autocapitalize="characters"
            />
          </label>
          <datalist id="instr-list">
            @for (i of instruments(); track i.id) {
              <option [value]="i.symbol">{{ i.name }}</option>
            }
          </datalist>
        }

        <label class="field">
          <span class="label">Data</span>
          <input type="date" [value]="date()" (input)="setDate($event)" />
        </label>

        @if (type() !== 'dividend') {
          <label class="field">
            <span class="label">Quantità</span>
            <input
              type="number"
              inputmode="decimal"
              step="any"
              [value]="quantity() ?? ''"
              (input)="setQuantity($event)"
            />
          </label>
        }

        <label class="field">
          <span class="label">{{
            type() === 'dividend' ? 'Importo dividendo (€)' : 'Importo totale (€)'
          }}</span>
          <input
            type="number"
            inputmode="decimal"
            step="any"
            [value]="amount() ?? ''"
            (input)="setAmount($event)"
          />
        </label>

        @if (type() !== 'dividend' && price() !== null) {
          <div class="price-row secondary">
            Prezzo medio: <strong class="num">{{ eur(price()!) }}</strong>
            <span class="muted">(importo / quantità, commissioni incluse)</span>
          </div>
        }
      </div>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      <div class="actions">
        <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="save()">
          {{ busy() ? 'Salvataggio…' : 'Salva operazione' }}
        </button>
        <a class="btn btn-ghost" routerLink="/portfolio">Annulla</a>
      </div>
    </section>
  `,
  styles: [
    `
      .segmented {
        display: inline-flex;
        background: var(--surface-2);
        border-radius: var(--radius);
        padding: 3px;
        margin-bottom: var(--space-4);
      }
      .segmented button {
        border: 0;
        background: transparent;
        color: var(--text-secondary);
        padding: var(--space-2) var(--space-4);
        border-radius: calc(var(--radius) - 3px);
        font-weight: var(--fw-medium);
      }
      .segmented button.active {
        background: var(--surface);
        color: var(--text);
        box-shadow: var(--shadow-sm);
      }
      .form {
        padding: var(--space-5);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      input {
        padding: var(--space-3);
        border: 1px solid var(--border-strong);
        border-radius: var(--radius);
        background: var(--surface-2);
        font-variant-numeric: tabular-nums;
      }
      input:focus-visible {
        border-color: var(--accent);
        outline: none;
      }
      .price-row {
        font-size: var(--fs-label);
      }
      .error {
        color: var(--negative);
        font-size: var(--fs-label);
        margin-top: var(--space-3);
      }
      .actions {
        display: flex;
        gap: var(--space-2);
        margin-top: var(--space-5);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionFormPage {
  private readonly portfolio = inject(PortfolioService);
  private readonly instrumentsRepo = inject(InstrumentsRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Se presente nel path, l'operazione è su un titolo esistente (simbolo bloccato). */
  private readonly preset = (this.route.snapshot.paramMap.get('symbol') ?? '').toUpperCase();
  protected readonly locked = this.preset.length > 0;

  protected readonly instruments = signal<Instrument[]>([]);
  protected readonly type = signal<TxKind>('buy');
  protected readonly symbol = signal(this.preset);
  protected readonly date = signal(todayIso());
  protected readonly quantity = signal<number | null>(null);
  protected readonly amount = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly price = computed(() => {
    const q = this.quantity();
    const a = this.amount();
    return q && a ? a / q : null;
  });

  constructor() {
    void this.instrumentsRepo.list().then((xs) => this.instruments.set(xs));
  }

  protected setSymbol(e: Event): void {
    this.symbol.set((e.target as HTMLInputElement).value);
  }
  protected setDate(e: Event): void {
    this.date.set((e.target as HTMLInputElement).value);
  }
  protected setQuantity(e: Event): void {
    this.quantity.set(this.num(e));
  }
  protected setAmount(e: Event): void {
    this.amount.set(this.num(e));
  }
  private num(e: Event): number | null {
    const n = parseFloat((e.target as HTMLInputElement).value.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  protected eur(v: number): string {
    return formatEur(v, { cents: true });
  }

  protected async save(): Promise<void> {
    if (this.busy()) return;
    const symbol = this.symbol().trim();
    if (!symbol) {
      this.error.set('Indica lo strumento.');
      return;
    }
    const date = parseDate(this.date());
    this.error.set(null);
    this.busy.set(true);
    try {
      if (this.type() === 'dividend') {
        const amount = this.amount() ?? 0;
        if (amount <= 0) throw new Error("Inserisci l'importo del dividendo.");
        await this.portfolio.addDividend({ symbol, date, amount });
      } else {
        const quantity = this.quantity() ?? 0;
        const amount = this.amount() ?? 0;
        if (quantity <= 0 || amount <= 0)
          throw new Error('Quantità e importo devono essere maggiori di 0.');
        if (this.type() === 'buy') await this.portfolio.addBuy({ symbol, date, quantity, amount });
        else await this.portfolio.addSell({ symbol, date, quantity, amount });
      }
      await this.router.navigateByUrl('/portfolio');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Operazione non riuscita.');
    } finally {
      this.busy.set(false);
    }
  }
}
