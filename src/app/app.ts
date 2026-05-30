import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);

  protected readonly isDark = computed(() => this.theme.resolved() === 'dark');
  /** Mostra l'avviso di configurazione quando Firebase non è impostato. */
  protected readonly needsConfig = !this.auth.configured;

  protected toggleTheme(): void {
    this.theme.toggle();
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
  }
}
