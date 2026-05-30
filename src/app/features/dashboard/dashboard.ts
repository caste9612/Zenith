import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AccountsRepository, SnapshotsRepository } from '../../core/data';
import { formatEur, formatSignedEur } from '../../core/money/format';
import { Owner, OWNER_LABELS, OWNERS } from '../../core/models';

const monthFmt = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });

@Component({
  selector: 'app-dashboard',
  template: `
    <section class="page">
      <header class="page-header">
        <h1>Dashboard</h1>
        <p class="subtitle">Patrimonio netto del nucleo e andamento storico.</p>
      </header>

      @if (latest(); as l) {
        <div class="hero card">
          <span class="label">Patrimonio netto · {{ monthLabel() }}</span>
          <div class="hero-value num">{{ eur(l.netWorth) }}</div>
          <div class="deltas">
            @if (deltaMonth() !== null) {
              <span class="num" [class.gain]="deltaMonth()! > 0" [class.loss]="deltaMonth()! < 0">{{
                signed(deltaMonth()!)
              }}</span>
              <span class="muted">nel mese</span>
            }
            @if (deltaYear() !== null) {
              <span
                class="num"
                [class.gain]="deltaYear()! > 0"
                [class.loss]="deltaYear()! < 0"
                style="margin-left:var(--space-4)"
                >{{ signed(deltaYear()!) }}</span
              >
              <span class="muted">12 mesi</span>
            }
          </div>

          @if (chart(); as c) {
            <svg
              class="spark"
              [attr.viewBox]="'0 0 ' + c.w + ' ' + c.h"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path [attr.d]="c.area" class="spark-area" />
              <path [attr.d]="c.line" class="spark-line" />
            </svg>
          }
        </div>

        <h2 class="section-title">Per intestatario</h2>
        <div class="grid owners">
          @for (o of ownerTotals(); track o.owner) {
            <div class="card mini">
              <span class="label">{{ o.label }}</span>
              <span class="num value">{{ eur(o.total) }}</span>
            </div>
          }
        </div>

        <h2 class="section-title">Ripartizione per voce</h2>
        <div class="stack-sm">
          @for (b of breakdown(); track b.id) {
            <div class="card voce">
              <span class="dot" [attr.data-owner]="b.owner"></span>
              <div class="voce-name">
                <div>{{ b.name }}</div>
                <div class="muted small">{{ ownerLabel(b.owner) }} · {{ b.pct }}%</div>
              </div>
              <span class="num value">{{ eur(b.value) }}</span>
            </div>
          }
        </div>
      } @else {
        <div class="card empty">
          <p class="secondary">
            Nessun dato ancora. Dopo l'import dello storico vedrai qui il patrimonio netto, la
            variazione e l'andamento nel tempo.
          </p>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .hero {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-6);
      }
      .hero-value {
        font-size: var(--fs-display);
        font-weight: var(--fw-bold);
        letter-spacing: -0.02em;
      }
      .deltas {
        display: flex;
        align-items: baseline;
        gap: var(--space-1);
        font-size: var(--fs-label);
      }
      .deltas .num {
        font-weight: var(--fw-semibold);
      }
      .spark {
        width: 100%;
        height: 120px;
        margin-top: var(--space-4);
        overflow: visible;
      }
      .spark-line {
        fill: none;
        stroke: var(--accent);
        stroke-width: 2;
        vector-effect: non-scaling-stroke;
      }
      .spark-area {
        fill: var(--accent-soft);
        stroke: none;
        opacity: 0.7;
      }
      .section-title {
        margin: var(--space-6) 0 var(--space-3);
        font-size: var(--fs-h2);
      }
      .owners {
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      }
      .mini {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-4);
      }
      .mini .value {
        font-size: 1.15rem;
        font-weight: var(--fw-semibold);
      }
      .voce {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
      }
      .voce-name {
        flex: 1;
        min-width: 0;
      }
      .voce .value {
        font-weight: var(--fw-semibold);
      }
      .small {
        font-size: var(--fs-small);
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
      .empty {
        padding: var(--space-6);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly accountsRepo = inject(AccountsRepository);
  private readonly snapshotsRepo = inject(SnapshotsRepository);

  // Letture in tempo reale (Firestore onSnapshot → Signal).
  protected readonly accounts = this.accountsRepo.connectOrdered();
  protected readonly snapshots = this.snapshotsRepo.connectByDate();

  protected readonly latest = computed(() => this.snapshots().at(-1) ?? null);

  protected readonly deltaMonth = computed<number | null>(() => {
    const s = this.snapshots();
    return s.length >= 2 ? s[s.length - 1].netWorth - s[s.length - 2].netWorth : null;
  });

  protected readonly deltaYear = computed<number | null>(() => {
    const s = this.snapshots();
    return s.length >= 13 ? s[s.length - 1].netWorth - s[s.length - 13].netWorth : null;
  });

  protected readonly ownerTotals = computed(() => {
    const l = this.latest();
    if (!l) return [];
    const totals = new Map<Owner, number>();
    for (const a of this.accounts()) {
      const v = l.values[a.id ?? ''] ?? 0;
      totals.set(a.owner, (totals.get(a.owner) ?? 0) + (a.isLiability ? -v : v));
    }
    return OWNERS.filter((o) => totals.has(o)).map((o) => ({
      owner: o,
      label: OWNER_LABELS[o],
      total: totals.get(o) ?? 0,
    }));
  });

  protected readonly breakdown = computed(() => {
    const l = this.latest();
    if (!l) return [];
    const total = l.netWorth || 1;
    return this.accounts()
      .map((a) => ({
        id: a.id ?? a.name,
        name: a.name,
        owner: a.owner,
        value: l.values[a.id ?? ''] ?? 0,
      }))
      .filter((b) => b.value !== 0)
      .sort((x, y) => y.value - x.value)
      .map((b) => ({ ...b, pct: Math.round((b.value / total) * 100) }));
  });

  protected readonly chart = computed(() => {
    const pts = this.snapshots();
    if (pts.length < 2) return null;
    const vals = pts.map((p) => p.netWorth);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const w = 600;
    const h = 120;
    const pad = 6;
    const range = max - min || 1;
    const coords = pts.map((p, i) => {
      const x = pad + (i / (pts.length - 1)) * (w - 2 * pad);
      const y = pad + (1 - (p.netWorth - min) / range) * (h - 2 * pad);
      return [x, y] as const;
    });
    const line = coords
      .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(' ');
    const area =
      `M${pad} ${(h - pad).toFixed(1)} ` +
      coords.map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') +
      ` L${(w - pad).toFixed(1)} ${(h - pad).toFixed(1)} Z`;
    return { line, area, w, h };
  });

  protected monthLabel(): string {
    const l = this.latest();
    return l ? monthFmt.format(l.date) : '';
  }

  protected eur(v: number): string {
    return formatEur(v);
  }
  protected signed(v: number): string {
    return formatSignedEur(v);
  }
  protected ownerLabel(o: Owner): string {
    return OWNER_LABELS[o];
  }
}
