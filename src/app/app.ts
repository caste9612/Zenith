import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { AuthService } from './core/auth/auth.service';
import { ThemePreference } from './core/models';
import { ThemeService } from './core/theme/theme.service';
import { UpdaterService } from './core/platform/updater';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly themeSvc = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  private readonly updaterSvc = inject(UpdaterService);

  /** Versione di un aggiornamento pronto (solo app nativa Tauri), altrimenti null. */
  protected readonly updateAvailable = this.updaterSvc.available;
  protected readonly updating = signal(false);

  constructor() {
    // Controllo aggiornamenti non bloccante all'avvio (no-op nel browser/PWA).
    void this.updaterSvc.checkOnStartup();
  }

  protected readonly isDark = computed(() => this.themeSvc.resolved() === 'dark');
  /** Preferenza tema corrente (light/dark/system) per il pannello impostazioni. */
  protected readonly theme = this.themeSvc.preference;
  /** Mostra l'avviso di configurazione quando Firebase non è impostato. */
  protected readonly needsConfig = !this.auth.configured;

  protected readonly baseCurrency = environment.baseCurrency;
  protected readonly staleness = environment.defaultQuoteStalenessMinutes;

  /** Apertura del pannello impostazioni, ancorato alla navbar. */
  protected readonly settingsOpen = signal(false);

  protected readonly themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'light', label: 'Chiaro' },
    { value: 'dark', label: 'Scuro' },
    { value: 'system', label: 'Sistema' },
  ];

  protected toggleTheme(): void {
    this.themeSvc.toggle();
  }

  protected setTheme(t: ThemePreference): void {
    this.themeSvc.set(t);
  }

  protected openSettings(): void {
    this.settingsOpen.set(true);
  }

  protected closeSettings(): void {
    this.settingsOpen.set(false);
  }

  protected async logout(): Promise<void> {
    this.settingsOpen.set(false);
    await this.auth.logout();
  }

  protected async installUpdate(): Promise<void> {
    this.updating.set(true);
    try {
      await this.updaterSvc.installAndRelaunch(); // in caso di successo l'app si riavvia
    } catch {
      this.updating.set(false);
    }
  }
}
