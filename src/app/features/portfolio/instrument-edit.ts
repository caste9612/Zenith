import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InstrumentsRepository } from '../../core/data';
import { Instrument, QuoteProviderId } from '../../core/models';
import { SymbolMatch, SymbolSearchService } from '../../core/quotes/symbol-search';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'GBX', 'CHF', 'HKD', 'SEK', 'DKK', 'NOK'];
type Source = 'finnhub' | 'alphavantage' | 'yahoo' | 'manual';
type AutoId = 'yahoo' | 'finnhub' | 'alphavantage';

interface AutoSource {
  id: AutoId;
  label: string;
  placeholder: string;
  hint: string;
}

/** Fonti automatiche, in ordine di preferenza (Yahoo prima: copertura globale). */
const AUTO: AutoSource[] = [
  {
    id: 'yahoo',
    label: 'Yahoo (globale)',
    placeholder: 'Es. FLOW.AS',
    hint: 'Quasi tutti i mercati. Aggiorna SOLO nell’app desktop/Android (la web app non può per via della CORS). Suffisso mercato: .AS Amsterdam, .MI Milano, .SW Svizzera, .HK Hong Kong, .L Londra.',
  },
  {
    id: 'finnhub',
    label: 'Finnhub (USA)',
    placeholder: 'Es. LBTYA',
    hint: 'Finnhub free: solo mercati USA. Funziona anche nella web app.',
  },
  {
    id: 'alphavantage',
    label: 'Alpha Vantage (Europa)',
    placeholder: 'Es. FLOW.AMS',
    hint: 'Mercati internazionali, dati EOD (fine giornata), max 25/giorno. Funziona anche nella web app. Suffisso: .AMS Amsterdam, .LON Londra, .PAR Parigi.',
  },
];

@Component({
  selector: 'app-instrument-edit',
  imports: [RouterLink],
  template: `
    <section class="page">
      <header class="page-header">
        <h1>{{ name() || 'Strumento' }}</h1>
        <p class="subtitle">Cerca il titolo, scegli la fonte del prezzo e la valuta.</p>
      </header>

      @if (loading()) {
        <div class="card"><p class="muted">Caricamento…</p></div>
      } @else {
        <div class="card stack-sm form">
          <!-- RICERCA -->
          <label class="field">
            <span class="label">Cerca titolo</span>
            <input
              [value]="searchQuery()"
              (input)="onSearchInput($event)"
              placeholder="Nome o ticker (es. Flow Traders, ACOMO, CK Hutchison)"
            />
            @if (!searchSvc.fullSearchAvailable) {
              <span class="muted small">
                Ricerca completa (Yahoo) solo nell’app desktop/Android; qui nel browser vedi i
                risultati Finnhub (USA).
              </span>
            }
          </label>
          @if (searching()) {
            <p class="muted small">Ricerca…</p>
          }
          @if (matches().length) {
            <ul class="matches">
              @for (m of matches(); track m.provider + ':' + m.symbol) {
                <li>
                  <button type="button" class="match" (click)="pick(m)">
                    <span class="m-name">{{ m.name }}</span>
                    <span class="m-meta muted small">{{ metaLine(m) }}</span>
                  </button>
                </li>
              }
            </ul>
          } @else if (searched() && !searching()) {
            <p class="muted small">Nessun risultato per “{{ searchQuery() }}”.</p>
          }

          <!-- NOME -->
          <label class="field">
            <span class="label">Nome</span>
            <input [value]="name()" (input)="name.set(val($event))" />
          </label>

          <!-- VALUTA -->
          <label class="field">
            <span class="label">Valuta di quotazione</span>
            <select (change)="currency.set(val($event))">
              @for (c of currencies; track c) {
                <option [value]="c" [selected]="c === currency()">{{ c }}</option>
              }
            </select>
            <span class="muted small">
              Informativa: la conversione in EUR usa comunque la valuta restituita dalla quotazione.
            </span>
          </label>

          <!-- FONTE PRIMARIA -->
          <div class="field">
            <span class="label">Fonte prezzo</span>
            <div class="segmented">
              @for (a of autos; track a.id) {
                <button type="button" [class.active]="source() === a.id" (click)="source.set(a.id)">
                  {{ a.label }}
                </button>
              }
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
              <span class="label">Simbolo {{ currentAuto().label }}</span>
              <input
                [value]="symOf(source())"
                (input)="setSym(source(), val($event))"
                [placeholder]="currentAuto().placeholder"
              />
              <span class="muted small">{{ currentAuto().hint }}</span>
            </label>

            <details class="field advanced">
              <summary class="label">Altri simboli (fallback, opzionale)</summary>
              <p class="muted small">
                Se imposti più fonti, l’app prova prima la primaria e poi le altre: utile per coprire
                più mercati o non esaurire la quota di una singola fonte.
              </p>
              @for (a of otherAutos(); track a.id) {
                <label class="field">
                  <span class="label small">{{ a.label }}</span>
                  <input
                    [value]="symOf(a.id)"
                    (input)="setSym(a.id, val($event))"
                    [placeholder]="a.placeholder"
                  />
                </label>
              }
            </details>
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
      .matches {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
        max-height: 280px;
        overflow: auto;
        border: 1px solid var(--border);
        border-radius: var(--radius);
      }
      .match {
        width: 100%;
        text-align: left;
        border: 0;
        background: transparent;
        padding: var(--space-2) var(--space-3);
        border-radius: calc(var(--radius) - 2px);
        display: flex;
        flex-direction: column;
        gap: 2px;
        cursor: pointer;
      }
      .match:hover {
        background: var(--surface-2);
      }
      .m-name {
        font-weight: var(--fw-medium);
      }
      .advanced summary {
        cursor: pointer;
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
  protected readonly searchSvc = inject(SymbolSearchService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly currencies = CURRENCIES;
  protected readonly autos = AUTO;

  protected readonly loading = signal(true);
  protected readonly name = signal('');
  protected readonly currency = signal('EUR');
  protected readonly source = signal<Source>('manual');
  /** Simboli per provider in modifica (mappa providerSymbols). */
  protected readonly symbols = signal<Partial<Record<QuoteProviderId, string>>>({});
  protected readonly manualPrice = signal<number | null>(null);
  protected readonly busy = signal(false);

  // ricerca
  protected readonly searchQuery = signal('');
  protected readonly matches = signal<SymbolMatch[]>([]);
  protected readonly searching = signal(false);
  protected readonly searched = signal(false);
  private searchSeq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  private original: Instrument | null = null;

  protected readonly currentAuto = computed(
    () => AUTO.find((a) => a.id === this.source()) ?? AUTO[0],
  );
  protected readonly otherAutos = computed(() => AUTO.filter((a) => a.id !== this.source()));

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    const ins = (await this.repo.list()).find((i) => (i.id ?? i.symbol) === this.id);
    if (ins) {
      this.original = ins;
      this.name.set(ins.name);
      this.currency.set(ins.currency || 'EUR');
      const src: Source = (['finnhub', 'alphavantage', 'yahoo', 'manual'] as const).includes(
        ins.provider as Source,
      )
        ? (ins.provider as Source)
        : 'manual';
      this.source.set(src);
      // Pre-carica i simboli per-provider; per i titoli "legacy" semina il simbolo sotto il provider.
      const seed: Partial<Record<QuoteProviderId, string>> = { ...(ins.providerSymbols ?? {}) };
      if (src !== 'manual' && !seed[src] && ins.symbol) seed[src] = ins.symbol;
      this.symbols.set(seed);
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

  protected metaLine(m: SymbolMatch): string {
    const parts = [m.symbol, m.exchange, this.providerLabel(m.provider)].filter(Boolean);
    return parts.join(' · ');
  }
  protected providerLabel(p: QuoteProviderId): string {
    return AUTO.find((a) => a.id === p)?.label.split(' ')[0] ?? p;
  }

  protected symOf(p: string): string {
    return this.symbols()[p as QuoteProviderId] ?? '';
  }
  protected setSym(p: string, v: string): void {
    this.symbols.update((s) => ({ ...s, [p]: v }));
  }

  protected onSearchInput(e: Event): void {
    const q = this.val(e);
    this.searchQuery.set(q);
    clearTimeout(this.searchTimer);
    if (q.trim().length < 2) {
      this.matches.set([]);
      this.searched.set(false);
      return;
    }
    this.searchTimer = setTimeout(() => void this.runSearch(q), 300);
  }

  private async runSearch(q: string): Promise<void> {
    const seq = ++this.searchSeq;
    this.searching.set(true);
    try {
      const r = await this.searchSvc.search(q);
      if (seq !== this.searchSeq) return; // risultato obsoleto: ignora
      this.matches.set(r);
      this.searched.set(true);
    } finally {
      if (seq === this.searchSeq) this.searching.set(false);
    }
  }

  protected pick(m: SymbolMatch): void {
    this.source.set(m.provider as Source);
    this.setSym(m.provider, m.symbol);
    if (!this.name().trim()) this.name.set(m.name);
    if (m.currency) this.currency.set(m.currency);
    this.matches.set([]);
    this.searchQuery.set('');
    this.searched.set(false);
  }

  protected async save(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const source = this.source();
      const provider: QuoteProviderId = source;

      // Mappa providerSymbols: solo le fonti automatiche con un simbolo valorizzato.
      const providerSymbols: Partial<Record<QuoteProviderId, string>> = {};
      for (const a of AUTO) {
        const t = (this.symbols()[a.id] ?? '').trim().toUpperCase();
        if (t) providerSymbols[a.id] = t;
      }

      // Simbolo "canonico" (anche id/visualizzazione): quello della fonte primaria, se auto.
      const primarySym =
        source === 'manual'
          ? (this.original?.symbol ?? this.id)
          : (providerSymbols[source] ?? this.original?.symbol ?? this.id);

      const inst: Instrument = {
        ...(this.original ?? { assetType: 'equity' }),
        id: this.id,
        symbol: (primarySym || this.id).toUpperCase(),
        name: this.name().trim() || primarySym,
        currency: this.currency().trim().toUpperCase() || 'EUR',
        provider,
        assetType: this.original?.assetType ?? 'equity',
      };
      if (source !== 'manual' && Object.keys(providerSymbols).length) {
        inst.providerSymbols = providerSymbols;
      }
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
