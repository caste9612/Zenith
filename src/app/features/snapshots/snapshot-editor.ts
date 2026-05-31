import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AccountsRepository, SnapshotsRepository } from '../../core/data';
import { formatEur } from '../../core/money/format';
import { Account, Owner, OWNER_LABELS, OWNERS, Snapshot } from '../../core/models';
import { computeNetWorth, totalsByOwner } from '../../core/balance/net-worth';
import { PortfolioService } from '../../core/portfolio/portfolio.service';

const monthFmt = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });

function monthKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
function nextMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return monthKeyOf(new Date(Date.UTC(y, m, 1))); // m (0-based) = mese successivo
}
/** Data di fine mese a mezzogiorno UTC (coerente con l'import, niente shift di fuso). */
function monthEndDate(key: string): Date {
  const [y, m] = key.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1, lastDay, 12, 0, 0));
}
function labelOf(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return monthFmt.format(new Date(Date.UTC(y, m - 1, 1, 12)));
}

@Component({
  selector: 'app-snapshot-editor',
  imports: [RouterLink],
  template: `
    <section class="page">
      <header class="page-header">
        <h1>{{ isNew() ? 'Nuovo snapshot' : 'Modifica snapshot' }}</h1>
        <p class="subtitle">{{ title() }}</p>
      </header>

      @if (loading()) {
        <div class="card"><p class="muted">Caricamento…</p></div>
      } @else {
        <div class="hero card">
          <span class="label">Patrimonio netto (calcolato)</span>
          <div class="hero-value num">{{ eur(netWorth()) }}</div>
        </div>

        @for (g of groups(); track g.owner) {
          <h2 class="section-title">{{ g.label }}</h2>
          <div class="stack-sm">
            @for (a of g.accounts; track a.id) {
              <label class="card field">
                <span class="fname">
                  {{ a.name }}
                  @if (a.linkedToPortfolio) {
                    <span class="hint">dal portafoglio</span>
                  }
                </span>
                <span class="input-wrap">
                  <input
                    type="number"
                    inputmode="decimal"
                    step="any"
                    [value]="fieldValue(a.id ?? '')"
                    (input)="setValue(a.id ?? '', $event)"
                  />
                  <span class="cur">€</span>
                </span>
              </label>
            }
          </div>
        }

        <div class="actions">
          <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="save()">
            {{ busy() ? 'Salvataggio…' : 'Salva' }}
          </button>
          <a class="btn btn-ghost" routerLink="/snapshots">Annulla</a>
          <span class="spacer"></span>
          @if (!isNew()) {
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
      .hero {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-5);
      }
      .hero-value {
        font-size: var(--fs-h1);
        font-weight: var(--fw-bold);
      }
      .section-title {
        margin: var(--space-5) 0 var(--space-2);
        font-size: var(--fs-h2);
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
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .hint {
        font-size: var(--fs-small);
        font-weight: var(--fw-regular);
        color: var(--accent);
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
        width: 130px;
        text-align: right;
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-sm);
        background: var(--surface-2);
        font-variant-numeric: tabular-nums;
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
export class SnapshotEditorPage {
  private readonly accountsRepo = inject(AccountsRepository);
  private readonly snapshotsRepo = inject(SnapshotsRepository);
  private readonly portfolio = inject(PortfolioService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly accounts = signal<Account[]>([]);
  protected readonly loading = signal(true);

  /** Voci disattivate ma presenti nello snapshot in modifica: vanno comunque mostrate. */
  private readonly extraIds = signal<Set<string>>(new Set());

  private readonly editId = signal<string | null>(this.route.snapshot.paramMap.get('id'));
  protected readonly isNew = computed(() => this.editId() === null);

  protected readonly monthKey = signal<string>('');
  protected readonly values = signal<Record<string, number>>({});
  protected readonly busy = signal(false);

  protected readonly groups = computed(() => {
    const extra = this.extraIds();
    const accs = this.accounts().filter((a) => a.active !== false || extra.has(a.id ?? ''));
    return OWNERS.map((o) => ({
      owner: o,
      label: OWNER_LABELS[o],
      accounts: accs.filter((a) => a.owner === o),
    })).filter((g) => g.accounts.length > 0);
  });

  protected readonly netWorth = computed(() => computeNetWorth(this.accounts(), this.values()));

  protected readonly title = computed(() => (this.monthKey() ? labelOf(this.monthKey()) : ''));

  constructor() {
    void this.init();
  }

  /** Caricamento deterministico: attende accounts E snapshots prima di seedare il form. */
  private async init(): Promise<void> {
    const [accs, snaps] = await Promise.all([
      this.accountsRepo.listOrdered(),
      this.snapshotsRepo.listByDate(),
    ]);
    this.accounts.set(accs);
    const id = this.editId();
    if (id) {
      const snap = snaps.find((s) => s.id === id);
      this.monthKey.set(id);
      const values = snap ? { ...snap.values } : {};
      this.values.set(values);
      // mantieni visibili eventuali voci ora disattivate ma valorizzate in questo snapshot
      this.extraIds.set(new Set(Object.keys(values).filter((k) => (values[k] ?? 0) !== 0)));
    } else {
      const last = snaps.at(-1) ?? null;
      const key = last ? nextMonthKey(last.id ?? monthKeyOf(last.date)) : monthKeyOf(new Date());
      this.monthKey.set(key);
      const values = last ? { ...last.values } : {}; // precompila dal mese precedente
      // le voci alimentate dal portafoglio si precompilano dal valore live (es. "Azionario")
      const linked = accs.filter((a) => a.linkedToPortfolio && a.id);
      if (linked.length) {
        const portfolioValue = await this.portfolio.currentValueEur();
        for (const a of linked) values[a.id as string] = portfolioValue;
      }
      this.values.set(values);
    }
    this.loading.set(false);
  }

  protected fieldValue(accountId: string): number {
    return this.values()[accountId] ?? 0;
  }

  protected setValue(accountId: string, event: Event): void {
    const raw = (event.target as HTMLInputElement).value.replace(',', '.');
    const n = parseFloat(raw);
    this.values.update((v) => ({ ...v, [accountId]: Number.isFinite(n) ? n : 0 }));
  }

  protected eur(v: number): string {
    return formatEur(v);
  }

  protected async save(): Promise<void> {
    const key = this.monthKey();
    if (!key || this.busy()) return;
    this.busy.set(true);
    try {
      const byOwner = Object.fromEntries(totalsByOwner(this.accounts(), this.values())) as Partial<
        Record<Owner, number>
      >;
      const snapshot: Snapshot = {
        id: key,
        date: monthEndDate(key),
        values: this.values(),
        netWorth: Math.round(this.netWorth() * 100) / 100,
        byOwner,
      };
      await this.snapshotsRepo.upsert(snapshot);
      await this.router.navigateByUrl('/snapshots');
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const id = this.editId();
    if (!id || this.busy()) return;
    this.busy.set(true);
    try {
      await this.snapshotsRepo.remove(id);
      await this.router.navigateByUrl('/snapshots');
    } finally {
      this.busy.set(false);
    }
  }
}
