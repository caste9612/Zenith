import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SnapshotsRepository } from '../../core/data';
import { formatEur, formatSignedEur } from '../../core/money/format';

const monthFmt = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });

@Component({
  selector: 'app-snapshots',
  template: `
    <section class="page">
      <header class="page-header row row-between">
        <div>
          <h1>Snapshot</h1>
          <p class="subtitle">Lo storico mensile del patrimonio.</p>
        </div>
        <button class="btn btn-primary" type="button" disabled title="Disponibile a breve">
          + Nuovo
        </button>
      </header>

      @if (rows().length) {
        <div class="stack-sm">
          @for (r of rows(); track r.id) {
            <div class="card snap">
              <span class="month">{{ r.label }}</span>
              <span class="spacer"></span>
              @if (r.delta !== null) {
                <span class="num delta" [class.gain]="r.delta! > 0" [class.loss]="r.delta! < 0">
                  {{ signed(r.delta!) }}
                </span>
              }
              <span class="num value">{{ eur(r.netWorth) }}</span>
            </div>
          }
        </div>
      } @else {
        <div class="card empty">
          <p class="secondary">
            Nessuno snapshot ancora. Dopo l'import vedrai qui un record per ogni mese.
          </p>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .snap {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
      }
      .month {
        text-transform: capitalize;
        font-weight: var(--fw-medium);
      }
      .delta {
        font-size: var(--fs-label);
        font-weight: var(--fw-semibold);
      }
      .value {
        font-weight: var(--fw-semibold);
        min-width: 96px;
        text-align: right;
      }
      .empty {
        padding: var(--space-6);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SnapshotsPage {
  private readonly repo = inject(SnapshotsRepository);
  private readonly snaps = this.repo.connectByDate(); // cronologico asc

  protected readonly rows = computed(() => {
    const s = this.snaps();
    return s
      .map((snap, i) => ({
        id: snap.id ?? String(i),
        label: monthFmt.format(snap.date),
        netWorth: snap.netWorth,
        delta: i > 0 ? snap.netWorth - s[i - 1].netWorth : null,
      }))
      .reverse(); // più recente in alto
  });

  protected eur(v: number): string {
    return formatEur(v);
  }
  protected signed(v: number): string {
    return formatSignedEur(v);
  }
}
