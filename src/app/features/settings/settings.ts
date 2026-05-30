import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { ThemePreference } from '../../core/models';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-settings',
  template: `
    <section class="page">
      <header class="page-header">
        <h1>Impostazioni</h1>
        <p class="subtitle">Aspetto, valuta e stato del servizio.</p>
      </header>

      <div class="stack">
        <div class="card setting">
          <div>
            <div class="label">Tema</div>
            <div class="muted">Chiaro, scuro o in base al sistema.</div>
          </div>
          <div class="segmented">
            @for (opt of themeOptions; track opt.value) {
              <button
                type="button"
                [class.active]="theme() === opt.value"
                (click)="setTheme(opt.value)"
              >
                {{ opt.label }}
              </button>
            }
          </div>
        </div>

        <div class="card setting">
          <div>
            <div class="label">Valuta base</div>
            <div class="muted">Valuta di riferimento del patrimonio.</div>
          </div>
          <span class="chip">{{ baseCurrency }}</span>
        </div>

        <div class="card setting">
          <div>
            <div class="label">Freschezza quotazioni</div>
            <div class="muted">Oltre questa soglia, all'avvio le quote vengono riaggiornate.</div>
          </div>
          <span class="chip">{{ staleness }} min</span>
        </div>

        <div class="card setting">
          <div>
            <div class="label">Stato Firebase</div>
            <div class="muted">
              @if (auth.configured) {
                @if (auth.user(); as u) {
                  Connesso come {{ u.email }}.
                } @else {
                  Configurato. Effettua l'accesso.
                }
              } @else {
                Copia <code>.env.example</code> in <code>.env</code> e compila i valori.
              }
            </div>
          </div>
          <span class="chip" [class.ok]="auth.configured" [class.warn]="!auth.configured">
            {{ auth.configured ? 'Configurato' : 'Da configurare' }}
          </span>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .setting {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
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
        transition:
          background var(--t-fast),
          color var(--t-fast);
      }
      .segmented button.active {
        background: var(--surface);
        color: var(--text);
        box-shadow: var(--shadow-sm);
      }
      .chip.ok {
        background: var(--positive-soft);
        color: var(--positive);
      }
      .chip.warn {
        background: var(--negative-soft);
        color: var(--negative);
      }
      code {
        background: var(--surface-2);
        padding: 1px 5px;
        border-radius: 5px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly themeSvc = inject(ThemeService);
  protected readonly auth = inject(AuthService);

  protected readonly theme = this.themeSvc.preference;
  protected readonly baseCurrency = environment.baseCurrency;
  protected readonly staleness = environment.defaultQuoteStalenessMinutes;

  protected readonly themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'light', label: 'Chiaro' },
    { value: 'dark', label: 'Scuro' },
    { value: 'system', label: 'Sistema' },
  ];

  protected setTheme(t: ThemePreference): void {
    this.themeSvc.set(t);
  }
}
