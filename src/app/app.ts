import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { AuthService } from './core/auth/auth.service';
import { ThemePreference } from './core/models';
import { ThemeService } from './core/theme/theme.service';

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
}
