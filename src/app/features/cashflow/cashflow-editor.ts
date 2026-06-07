import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CashFlowRepository } from '../../core/data';
import { CashFlowMonth } from '../../core/models';
import { formatEur, formatPercentPlain, formatSignedEur } from '../../core/money/format';

function monthKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function nextMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return monthKeyOf(new Date(Date.UTC(y, m, 1))); // m (0-based) = mese successivo
}
/** Fine mese a mezzogiorno UTC (coerente con l'import, niente shift di fuso). */
function monthEndDate(key: string): Date {
  const [y, m] = key.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1, lastDay, 12, 0, 0));
}

/**
 * Editor di un mese di cash flow (Antonio): lordo, netto, uscite. Tassazione (lordo−netto) e
 * risparmio (netto−uscite) sono calcolati. Scrive in users/{uid}/cashFlow (id YYYY-MM, idempotente):
 * selezionare un mese già presente lo carica per modificarlo.
 */
@Component({
  selector: 'app-cashflow-editor',
  imports: [RouterLink],
  template: `
    <section class="page">
      <header class="page-header">
        <h1>{{ exists() ? 'Modifica mese' : 'Nuovo mese' }}</h1>
        <p class="subtitle">Stipendio e uscite del mese (Antonio). Tassazione e risparmio calcolati.</p>
      </header>

      @if (loading()) {
        <div class="card"><p class="muted">Caricamento…</p></div>
      } @else {
        <div class="stack-sm">
          <label class="card field">
            <span class="fname">Mese</span>
            <input type="month" [value]="monthKey()" (change)="onMonth($event)" />
          </label>
          <label class="card field">
            <span class="fname">Lordo</span>
            <span class="input-wrap">
              <input
                type="number"
                inputmode="decimal"
                step="any"
                [value]="gross() ?? ''"
                (input)="setNum('gross', $event)"
              />
              <span class="cur">€</span>
            </span>
          </label>
          <label class="card field">
            <span class="fname">Netto</span>
            <span class="input-wrap">
              <input
                type="number"
                inputmode="decimal"
                step="any"
                [value]="income() ?? ''"
                (input)="setNum('income', $event)"
              />
              <span class="cur">€</span>
            </span>
          </label>
          <label class="card field">
            <span class="fname">Uscite</span>
            <span class="input-wrap">
              <input
                type="number"
                inputmode="decimal"
                step="any"
                [value]="expenses() ?? ''"
                (input)="setNum('expenses', $event)"
              />
              <span class="cur">€</span>
            </span>
          </label>
        </div>

        <div class="grid summary">
          <div class="card mini">
            <span class="label">Tassazione</span>
            <span class="num value">{{ tax() === null ? '—' : eur(tax()!) }}</span>
            <span class="muted small">{{
              netRate() === null ? 'lordo − netto' : pct(netRate()!) + ' netto sul lordo'
            }}</span>
          </div>
          <div class="card mini">
            <span class="label">Risparmio</span>
            <span
              class="num value"
              [class.gain]="(saved() ?? 0) > 0"
              [class.loss]="(saved() ?? 0) < 0"
              >{{ saved() === null ? '—' : signed(saved()!) }}</span
            >
            <span class="muted small">netto − uscite</span>
          </div>
        </div>

        <div class="actions">
          <button
            class="btn btn-primary"
            type="button"
            [disabled]="busy() || !monthKey()"
            (click)="save()"
          >
            {{ busy() ? 'Salvataggio…' : 'Salva' }}
          </button>
          <a class="btn btn-ghost" routerLink="/cashflow">Annulla</a>
          <span class="spacer"></span>
          @if (exists()) {
            <button class="btn btn-danger" type="button" [disabled]="busy()" (click)="remove()">
              Elimina
            </button>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      .summary {
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        margin-top: var(--space-4);
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
      .field {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-2) var(--space-4);
        cursor: text;
      }
      .fname {
        font-weight: var(--fw-medium);
      }
      .input-wrap {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
      }
      .input-wrap .cur {
        color: var(--text-muted);
      }
      input {
        width: 150px;
        text-align: right;
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-sm);
        background: var(--surface-2);
        color: var(--text);
        font: inherit;
        font-variant-numeric: tabular-nums;
      }
      input[type='month'] {
        text-align: left;
      }
      input:focus-visible {
        border-color: var(--accent);
        outline: none;
      }
      .actions {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-top: var(--space-6);
      }
      .btn-danger {
        background: transparent;
        border-color: var(--negative);
        color: var(--negative);
      }
      .btn-danger:hover {
        background: var(--negative-soft);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashFlowEditorPage {
  private readonly repo = inject(CashFlowRepository);
  private readonly router = inject(Router);

  protected readonly months = signal<CashFlowMonth[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);

  protected readonly monthKey = signal('');
  protected readonly gross = signal<number | null>(null);
  protected readonly income = signal<number | null>(null);
  protected readonly expenses = signal<number | null>(null);

  /** True se il mese scelto esiste già (modifica anziché inserimento). */
  protected readonly exists = computed(() => this.months().some((m) => m.id === this.monthKey()));

  protected readonly tax = computed(() => {
    const g = this.gross();
    const n = this.income();
    return g != null && n != null ? Math.round((g - n) * 100) / 100 : null;
  });
  protected readonly netRate = computed(() => {
    const g = this.gross();
    const n = this.income();
    return g != null && g > 0 && n != null ? n / g : null;
  });
  protected readonly saved = computed(() => {
    const n = this.income();
    const e = this.expenses();
    return n != null && e != null ? Math.round((n - e) * 100) / 100 : null;
  });

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    const all = await this.repo.list();
    this.months.set(all);
    const sorted = [...all].sort((a, b) => a.date.getTime() - b.date.getTime());
    const last = sorted.at(-1);
    const key = last ? nextMonthKey(last.id ?? monthKeyOf(last.date)) : monthKeyOf(new Date());
    this.monthKey.set(key);
    this.loadMonth(key);
    this.loading.set(false);
  }

  protected onMonth(e: Event): void {
    const key = (e.target as HTMLInputElement).value; // YYYY-MM
    if (!key) return;
    this.monthKey.set(key);
    this.loadMonth(key);
  }

  private loadMonth(key: string): void {
    const m = this.months().find((x) => x.id === key);
    this.gross.set(m?.gross ?? null);
    this.income.set(m?.income ?? null);
    this.expenses.set(m?.expenses ?? null);
  }

  protected setNum(field: 'gross' | 'income' | 'expenses', e: Event): void {
    const raw = (e.target as HTMLInputElement).value.replace(',', '.').trim();
    const n = raw === '' ? null : parseFloat(raw);
    const val = n != null && Number.isFinite(n) ? n : null;
    if (field === 'gross') this.gross.set(val);
    else if (field === 'income') this.income.set(val);
    else this.expenses.set(val);
  }

  protected async save(): Promise<void> {
    const key = this.monthKey();
    if (!key || this.busy()) return;
    this.busy.set(true);
    try {
      const m: CashFlowMonth = {
        id: key,
        date: monthEndDate(key),
        gross: this.gross(),
        income: this.income(),
        expenses: this.expenses(),
        tax: this.tax(),
        saved: this.saved(),
      };
      await this.repo.upsert(m);
      await this.router.navigateByUrl('/cashflow');
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const key = this.monthKey();
    if (!key || !this.exists() || this.busy()) return;
    this.busy.set(true);
    try {
      await this.repo.remove(key);
      await this.router.navigateByUrl('/cashflow');
    } finally {
      this.busy.set(false);
    }
  }

  protected eur(v: number): string {
    return formatEur(v);
  }
  protected signed(v: number): string {
    return formatSignedEur(v);
  }
  protected pct(v: number): string {
    return formatPercentPlain(v);
  }
}
