import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { AccessLogEntry } from '../../core/models';
import { AccessLogRepository } from '../../core/data/repositories';

/** Descrizione leggibile del dispositivo da piattaforma + user agent (pura, testabile). */
export function describeDevice(platform: string, userAgent: string): string {
  const base = platform === 'desktop' ? 'App desktop' : 'Web';
  const ua = userAgent || '';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : '';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad|iOS/.test(ua)
        ? 'iOS'
        : /Mac OS|Macintosh/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  return [base, browser, os].filter(Boolean).join(' · ');
}

const DATE_FMT = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * "Accessi recenti": elenco degli ultimi login al proprio account. Reso solo da utente
 * autenticato (vedi app.html), così la connessione realtime parte con un uid valido.
 */
@Component({
  selector: 'app-access-log',
  template: `
    <div class="access-log">
      <div class="label">Accessi recenti</div>
      <div class="muted">
        Ultimi accessi al tuo account. Se vedi un dispositivo o un orario che non riconosci,
        cambia subito la password.
      </div>
      @if (recent().length) {
        <ul class="log-list">
          @for (e of recent(); track e.id) {
            <li>
              <span class="when">{{ fmt(e.at) }}</span>
              <span class="dev">{{ device(e) }}</span>
            </li>
          }
        </ul>
      } @else {
        <div class="muted empty">Nessun accesso registrato ancora.</div>
      }
    </div>
  `,
  styles: [
    `
      .access-log {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .log-list {
        list-style: none;
        margin: var(--space-1) 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
      }
      .log-list li {
        display: flex;
        justify-content: space-between;
        gap: var(--space-3);
        font-size: var(--fs-label);
        padding: var(--space-2) 0;
        border-top: 1px solid var(--border);
      }
      .when {
        font-variant-numeric: tabular-nums;
      }
      .dev {
        color: var(--text-secondary);
        text-align: right;
      }
      .empty {
        padding-top: var(--space-1);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessLogList {
  private readonly repo = inject(AccessLogRepository);
  protected readonly recent = this.repo.connectRecent(8);

  protected fmt(d: Date): string {
    return d instanceof Date && !isNaN(d.getTime()) ? DATE_FMT.format(d) : '';
  }

  protected device(e: AccessLogEntry): string {
    return describeDevice(e.platform, e.userAgent);
  }
}
