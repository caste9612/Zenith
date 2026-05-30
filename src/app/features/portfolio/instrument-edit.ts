import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InstrumentsRepository } from '../../core/data';
import { Instrument, QuoteProviderId } from '../../core/models';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'GBX', 'CHF', 'HKD', 'SEK', 'DKK', 'NOK'];
type Source = 'finnhub' | 'alphavantage' | 'manual';

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
                [class.active]="source() === 'finnhub'"
                (click)="source.set('finnhub')"
              >
                Finnhub (USA)
              </button>
              <button
                type="button"
                [class.active]="source() === 'alphavantage'"
                (click)="source.set('alphavantage')"
              >
                Alpha Vantage (Europa)
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

          @if (source() === 'manual') {
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
          } @else {
            <label class="field">
              <span class="label"
                >Simbolo {{ source() === 'alphavantage' ? 'Alpha Vantage' : 'Finnhub' }}</span
              >
              <input
                [value]="symbol()"
                (input)="symbol.set(val($event))"
                [placeholder]="source() === 'alphavantage' ? 'Es. FLOW.AMS' : 'Es. LBTYA'"
              />
              @if (source() === 'alphavantage') {
                <span class="muted small">
                  Mercati internazionali (Euronext, Londra…), dati EOD. Suffisso mercato: .AMS
                  Amsterdam, .LON Londra, .PAR Parigi.
                </span>
              } @else {
                <span class="muted small">Finnhub free: solo mercati USA.</span>
              }
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
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
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
        font-size: var(--fs-label);
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
  protected readonly source = signal<Source>('manual');
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
      this.source.set(
        ins.provider === 'manual'
          ? 'manual'
          : ins.provider === 'alphavantage'
            ? 'alphavantage'
            : 'finnhub',
      );
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
      const provider: QuoteProviderId = this.source();
      const inst: Instrument = {
        ...(this.original ?? { assetType: 'equity' }),
        id: this.id,
        symbol: this.symbol().trim().toUpperCase() || this.id,
        name: this.name().trim() || this.symbol(),
        currency: this.currency().trim().toUpperCase() || 'EUR',
        provider,
        assetType: this.original?.assetType ?? 'equity',
      };
      if (provider === 'manual') {
        const p = this.manualPrice() ?? 0;
        inst.manualPrice = p;
        inst.lastPrice = p; // la valorizzazione usa subito il prezzo manuale
        inst.lastPriceAt = new Date();
      }
      await this.repo.upsert(inst);
      await this.router.navigateByUrl('/portfolio');
    } finally {
      this.busy.set(false);
    }
  }
}
