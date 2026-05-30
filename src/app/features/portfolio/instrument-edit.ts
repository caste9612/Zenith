import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InstrumentsRepository } from '../../core/data';
import { Instrument } from '../../core/models';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'HKD', 'SEK', 'DKK', 'NOK'];

@Component({
  selector: 'app-instrument-edit',
  imports: [RouterLink],
  template: `
    <section class="page">
      <header class="page-header">
        <h1>{{ symbol() || 'Strumento' }}</h1>
        <p class="subtitle">Fonte del prezzo e valuta.</p>
      </header>

      @if (loading()) {
        <div class="card"><p class="muted">Caricamento…</p></div>
      } @else {
        <div class="card stack-sm form">
          <label class="field">
            <span class="label">Nome</span>
            <input [value]="name()" (input)="name.set(val($event))" />
          </label>

          <label class="field">
            <span class="label">Valuta di quotazione</span>
            <select (change)="currency.set(val($event))">
              @for (c of currencies; track c) {
                <option [value]="c" [selected]="c === currency()">{{ c }}</option>
              }
            </select>
          </label>

          <div class="field">
            <span class="label">Fonte prezzo</span>
            <div class="segmented">
              <button
                type="button"
                [class.active]="source() === 'auto'"
                (click)="source.set('auto')"
              >
                Auto (Finnhub)
              </button>
              <button
                type="button"
                [class.active]="source() === 'manual'"
                (click)="source.set('manual')"
              >
                Manuale
              </button>
            </div>
          </div>

          @if (source() === 'auto') {
            <label class="field">
              <span class="label">Simbolo Finnhub</span>
              <input [value]="symbol()" (input)="symbol.set(val($event))" placeholder="Es. LBTYA" />
              <span class="muted small">
                Free tier: solo mercati USA. I titoli europei spesso non sono disponibili → usa
                "Manuale".
              </span>
            </label>
          } @else {
            <label class="field">
              <span class="label">Prezzo attuale (€)</span>
              <input
                type="number"
                inputmode="decimal"
                step="any"
                [value]="manualPrice() ?? ''"
                (input)="manualPrice.set(num($event))"
              />
              <span class="muted small">Aggiornalo quando vuoi (come facevi nell'Excel).</span>
            </label>
          }
        </div>

        <div class="actions">
          <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="save()">
            {{ busy() ? 'Salvataggio…' : 'Salva' }}
          </button>
          <a class="btn btn-ghost" routerLink="/portfolio">Annulla</a>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .form {
        padding: var(--space-5);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      input,
      select {
        padding: var(--space-3);
        border: 1px solid var(--border-strong);
        border-radius: var(--radius);
        background: var(--surface-2);
      }
      .small {
        font-size: var(--fs-small);
      }
      .segmented {
        display: inline-flex;
        background: var(--surface-2);
        border-radius: var(--radius);
        padding: 3px;
      }
      .segmented button {
        border: 0;
        background: transparent;
        color: var(--text-secondary);
        padding: var(--space-2) var(--space-3);
        border-radius: calc(var(--radius) - 3px);
        font-weight: var(--fw-medium);
      }
      .segmented button.active {
        background: var(--surface);
        color: var(--text);
        box-shadow: var(--shadow-sm);
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
export class InstrumentEditPage {
  private readonly repo = inject(InstrumentsRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly currencies = CURRENCIES;

  protected readonly loading = signal(true);
  protected readonly symbol = signal('');
  protected readonly name = signal('');
  protected readonly currency = signal('EUR');
  protected readonly source = signal<'auto' | 'manual'>('manual');
  protected readonly manualPrice = signal<number | null>(null);
  protected readonly busy = signal(false);
  private original: Instrument | null = null;

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    const ins = (await this.repo.list()).find((i) => (i.id ?? i.symbol) === this.id);
    if (ins) {
      this.original = ins;
      this.symbol.set(ins.symbol);
      this.name.set(ins.name);
      this.currency.set(ins.currency || 'EUR');
      this.source.set(ins.provider === 'manual' ? 'manual' : 'auto');
      this.manualPrice.set(ins.manualPrice ?? ins.lastPrice ?? null);
    }
    this.loading.set(false);
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement).value;
  }
  protected num(e: Event): number | null {
    const n = parseFloat((e.target as HTMLInputElement).value.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  protected async save(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const manual = this.source() === 'manual';
      const inst: Instrument = {
        ...(this.original ?? { assetType: 'equity' }),
        id: this.id,
        symbol: this.symbol().trim().toUpperCase() || this.id,
        name: this.name().trim() || this.symbol(),
        currency: this.currency().trim().toUpperCase() || 'EUR',
        provider: manual ? 'manual' : 'finnhub',
        assetType: this.original?.assetType ?? 'equity',
      };
      if (manual) {
        const p = this.manualPrice() ?? 0;
        inst.manualPrice = p;
        inst.lastPrice = p; // così la valorizzazione usa subito il prezzo manuale
        inst.lastPriceAt = new Date();
      }
      await this.repo.upsert(inst);
      await this.router.navigateByUrl('/portfolio');
    } finally {
      this.busy.set(false);
    }
  }
}
