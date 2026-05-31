import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountsRepository } from '../../core/data';
import { ASSET_CLASS_LABELS, OWNER_LABELS } from '../../core/models';

/**
 * Elenco delle voci del patrimonio (conti, fondi, riserve, contenitori del portafoglio).
 * Da qui si aggiunge una nuova voce o si apre il dettaglio per modificarla/disattivarla.
 */
@Component({
  selector: 'app-accounts',
  imports: [RouterLink],
  template: `
    <section class="page">
      <header class="page-header">
        <h1>Conti e voci</h1>
        <p class="subtitle">Le voci che compongono il patrimonio negli snapshot mensili.</p>
      </header>

      <div class="stack-sm">
        @for (a of accounts(); track a.id) {
          <a
            class="card row-item"
            [class.off]="a.active === false"
            [routerLink]="['/accounts', a.id]"
          >
            <span class="dot" [attr.data-owner]="a.owner"></span>
            <div class="main">
              <div class="name">
                {{ a.name }}
                @if (a.linkedToPortfolio) {
                  <span class="tag accent">portafoglio</span>
                }
                @if (a.isLiability) {
                  <span class="tag neg">passività</span>
                }
                @if (a.active === false) {
                  <span class="tag">disattivata</span>
                }
              </div>
              <div class="muted small">{{ ownerLabel(a.owner) }} · {{ classLabel(a) }}</div>
            </div>
            <span class="chev">›</span>
          </a>
        }

        <a class="card add-card" routerLink="/accounts/new">
          <span class="plus">+</span>
          <span class="add-label">Aggiungi voce</span>
        </a>
      </div>
    </section>
  `,
  styles: [
    `
      .row-item {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        text-decoration: none;
        color: inherit;
        transition: background var(--t-fast);
      }
      .row-item:hover {
        background: var(--surface-hover);
      }
      .row-item.off {
        opacity: 0.55;
      }
      .main {
        flex: 1;
        min-width: 0;
      }
      .name {
        font-weight: var(--fw-medium);
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .small {
        font-size: var(--fs-small);
      }
      .tag {
        font-size: var(--fs-small);
        padding: 1px 7px;
        border-radius: var(--radius-pill);
        background: var(--surface-2);
        color: var(--text-secondary);
        font-weight: var(--fw-regular);
      }
      .tag.accent {
        background: var(--accent-soft, var(--surface-2));
        color: var(--accent);
      }
      .tag.neg {
        background: var(--negative-soft);
        color: var(--negative);
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
      .chev {
        color: var(--text-muted);
        font-size: 1.4rem;
        line-height: 1;
      }
      .add-card {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        color: var(--text-secondary);
        text-decoration: none;
        border-style: dashed;
        transition: background var(--t-fast);
      }
      .add-card:hover {
        background: var(--surface-hover);
        color: var(--text);
      }
      .plus {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--surface-2);
        color: var(--accent);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
        font-weight: var(--fw-bold);
        flex: none;
      }
      .add-label {
        font-weight: var(--fw-medium);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountsPage {
  private readonly accountsRepo = inject(AccountsRepository);
  protected readonly accounts = this.accountsRepo.connectOrdered();

  protected ownerLabel(o: 'antonio' | 'michela' | 'shared'): string {
    return OWNER_LABELS[o];
  }
  protected classLabel(a: { assetClass: keyof typeof ASSET_CLASS_LABELS }): string {
    return ASSET_CLASS_LABELS[a.assetClass];
  }
}
