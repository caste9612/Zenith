import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AccountsRepository } from '../../core/data';
import {
  Account,
  ASSET_CLASSES,
  ASSET_CLASS_LABELS,
  AssetClass,
  Owner,
  OWNER_LABELS,
  OWNERS,
} from '../../core/models';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'];

/**
 * Crea o modifica una voce del patrimonio. Per le voci nuove l'id è generato da Firestore;
 * disattivare una voce la esclude dai nuovi snapshot mantenendo lo storico.
 */
@Component({
  selector: 'app-account-edit',
  imports: [RouterLink],
  template: `
    <section class="page">
      <header class="page-header">
        <h1>{{ isNew() ? 'Nuova voce' : name() || 'Voce' }}</h1>
        <p class="subtitle">Intestatario, classe e comportamento negli snapshot.</p>
      </header>

      @if (loading()) {
        <div class="card"><p class="muted">Caricamento…</p></div>
      } @else {
        <div class="card stack-sm form">
          <label class="field">
            <span class="label">Nome</span>
            <input
              [value]="name()"
              (input)="name.set(val($event))"
              placeholder="Es. Conto Intesa"
            />
          </label>

          <div class="field">
            <span class="label">Intestatario</span>
            <div class="segmented">
              @for (o of owners; track o) {
                <button type="button" [class.active]="owner() === o" (click)="owner.set(o)">
                  {{ ownerLabel(o) }}
                </button>
              }
            </div>
          </div>

          <label class="field">
            <span class="label">Classe di asset</span>
            <select (change)="assetClass.set(asClass($event))">
              @for (c of classes; track c) {
                <option [value]="c" [selected]="c === assetClass()">{{ classLabel(c) }}</option>
              }
            </select>
          </label>

          <label class="field">
            <span class="label">Valuta</span>
            <select (change)="currency.set(val($event))">
              @for (c of currencies; track c) {
                <option [value]="c" [selected]="c === currency()">{{ c }}</option>
              }
            </select>
          </label>

          <label class="check">
            <input type="checkbox" [checked]="active()" (change)="active.set(checked($event))" />
            <span>
              <span class="ctitle">Attiva</span>
              <span class="muted small">Se disattivata, non compare nei nuovi snapshot.</span>
            </span>
          </label>

          <label class="check">
            <input
              type="checkbox"
              [checked]="isLiability()"
              (change)="isLiability.set(checked($event))"
            />
            <span>
              <span class="ctitle">È una passività</span>
              <span class="muted small">Sottrae al patrimonio netto (es. mutuo).</span>
            </span>
          </label>

          <label class="check">
            <input
              type="checkbox"
              [checked]="linkedToPortfolio()"
              (change)="linkedToPortfolio.set(checked($event))"
            />
            <span>
              <span class="ctitle">Alimentata dal portafoglio</span>
              <span class="muted small">
                Nei nuovi snapshot il valore si precompila dal totale del portafoglio titoli.
              </span>
            </span>
          </label>

          <label class="field">
            <span class="label">Ordine</span>
            <input
              type="number"
              inputmode="numeric"
              step="1"
              [value]="order()"
              (input)="order.set(intVal($event))"
            />
            <span class="muted small">Posizione nelle liste e nel form dello snapshot.</span>
          </label>
        </div>

        <div class="actions">
          <button
            class="btn btn-primary"
            type="button"
            [disabled]="busy() || !name().trim()"
            (click)="save()"
          >
            {{ busy() ? 'Salvataggio…' : 'Salva' }}
          </button>
          <a class="btn btn-ghost" routerLink="/accounts">Annulla</a>
          <span class="spacer"></span>
          @if (!isNew()) {
            <button class="btn btn-danger" type="button" [disabled]="busy()" (click)="remove()">
              Elimina
            </button>
          }
        </div>
        @if (!isNew()) {
          <p class="muted small note">
            Eliminare una voce non cancella i valori già salvati negli snapshot passati. Per
            smettere di usarla mantenendo lo storico, disattivala.
          </p>
        }
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
      .check {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        cursor: pointer;
      }
      .check input {
        width: 18px;
        height: 18px;
        margin-top: 2px;
        flex: none;
        accent-color: var(--accent);
      }
      .check span {
        display: flex;
        flex-direction: column;
      }
      .ctitle {
        font-weight: var(--fw-medium);
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
        padding: var(--space-2) var(--space-4);
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
        align-items: center;
        gap: var(--space-2);
        margin-top: var(--space-5);
      }
      .spacer {
        flex: 1;
      }
      .btn-danger {
        background: transparent;
        border-color: var(--negative);
        color: var(--negative);
      }
      .btn-danger:hover {
        background: var(--negative-soft);
      }
      .note {
        margin-top: var(--space-3);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountEditPage {
  private readonly repo = inject(AccountsRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly id = this.route.snapshot.paramMap.get('id');
  protected readonly isNew = () => this.id === null;

  protected readonly owners = OWNERS;
  protected readonly classes = ASSET_CLASSES;
  protected readonly currencies = CURRENCIES;

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);

  protected readonly name = signal('');
  protected readonly owner = signal<Owner>('shared');
  protected readonly assetClass = signal<AssetClass>('cash');
  protected readonly currency = signal('EUR');
  protected readonly active = signal(true);
  protected readonly isLiability = signal(false);
  protected readonly linkedToPortfolio = signal(false);
  protected readonly order = signal(0);

  private original: Account | null = null;

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    const all = await this.repo.listOrdered();
    if (this.id !== null) {
      const a = all.find((x) => x.id === this.id);
      if (a) {
        this.original = a;
        this.name.set(a.name);
        this.owner.set(a.owner);
        this.assetClass.set(a.assetClass);
        this.currency.set(a.currency || 'EUR');
        this.active.set(a.active !== false);
        this.isLiability.set(!!a.isLiability);
        this.linkedToPortfolio.set(!!a.linkedToPortfolio);
        this.order.set(a.order ?? 0);
      }
    } else {
      // nuova voce: ordine in coda
      const maxOrder = all.reduce((m, a) => Math.max(m, a.order ?? 0), 0);
      this.order.set(maxOrder + 1);
    }
    this.loading.set(false);
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement).value;
  }
  protected asClass(e: Event): AssetClass {
    return (e.target as HTMLSelectElement).value as AssetClass;
  }
  protected checked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }
  protected intVal(e: Event): number {
    const n = parseInt((e.target as HTMLInputElement).value, 10);
    return Number.isFinite(n) ? n : 0;
  }

  protected ownerLabel(o: Owner): string {
    return OWNER_LABELS[o];
  }
  protected classLabel(c: AssetClass): string {
    return ASSET_CLASS_LABELS[c];
  }

  protected async save(): Promise<void> {
    if (this.busy() || !this.name().trim()) return;
    this.busy.set(true);
    try {
      const account: Account = {
        ...(this.original ?? {}),
        ...(this.id !== null ? { id: this.id } : {}),
        name: this.name().trim(),
        owner: this.owner(),
        assetClass: this.assetClass(),
        currency: this.currency().trim().toUpperCase() || 'EUR',
        isLiability: this.isLiability(),
        linkedToPortfolio: this.linkedToPortfolio(),
        active: this.active(),
        order: this.order(),
      };
      await this.repo.upsert(account);
      await this.router.navigateByUrl('/accounts');
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(): Promise<void> {
    if (this.id === null || this.busy()) return;
    this.busy.set(true);
    try {
      await this.repo.remove(this.id);
      await this.router.navigateByUrl('/accounts');
    } finally {
      this.busy.set(false);
    }
  }
}
