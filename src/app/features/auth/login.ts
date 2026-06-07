import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AccessLogRepository } from '../../core/data/repositories';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="auth-wrap">
      <div class="card auth-card">
        <div class="brand-row">
          <span class="brand-mark" aria-hidden="true"></span>
          <span class="brand-name">Zenith</span>
        </div>

        @if (!configured) {
          <p class="secondary">
            Firebase non è configurato. Copia <code>.env.example</code> in <code>.env</code>,
            compila i valori del progetto e riavvia per poter accedere.
          </p>
        } @else {
          <h1>Accedi</h1>
          <p class="subtitle secondary">Inserisci le tue credenziali.</p>

          <form (ngSubmit)="submit()" class="stack-sm">
            <label class="field">
              <span class="label">Email</span>
              <input
                type="email"
                name="email"
                autocomplete="username"
                [(ngModel)]="email"
                required
              />
            </label>
            <label class="field">
              <span class="label">Password</span>
              <input
                type="password"
                name="password"
                autocomplete="current-password"
                [(ngModel)]="password"
                required
              />
            </label>

            @if (error()) {
              <p class="error">{{ error() }}</p>
            }

            <div class="actions">
              <button class="btn btn-primary" type="submit" [disabled]="busy()">
                {{ busy() ? 'Attendi…' : 'Accedi' }}
              </button>
            </div>
          </form>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .auth-wrap {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: var(--space-5);
      }
      .auth-card {
        width: 100%;
        max-width: 380px;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding: var(--space-6);
      }
      .brand-row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        font-weight: var(--fw-bold);
        font-size: 1.1rem;
      }
      .brand-mark {
        width: 22px;
        height: 22px;
        border-radius: 6px;
        background: linear-gradient(135deg, var(--accent), var(--accent-hover));
        transform: rotate(45deg);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      input {
        padding: var(--space-3);
        border: 1px solid var(--border-strong);
        border-radius: var(--radius);
        background: var(--surface-2);
      }
      input:focus-visible {
        border-color: var(--accent);
        outline: none;
      }
      .actions {
        display: flex;
        gap: var(--space-2);
        margin-top: var(--space-2);
      }
      .actions .btn {
        flex: 1;
      }
      .error {
        color: var(--negative);
        font-size: var(--fs-label);
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
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly accessLog = inject(AccessLogRepository);

  protected readonly configured = this.auth.configured;
  protected email = '';
  protected password = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    if (this.busy()) return;
    this.error.set(null);
    this.busy.set(true);
    try {
      await this.auth.login(this.email, this.password);
      void this.accessLog.record(); // registra l'accesso (best-effort, non blocca il login)
      await this.router.navigateByUrl('/dashboard');
    } catch (e) {
      this.error.set(this.toMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  private toMessage(e: unknown): string {
    const code = (e as { code?: string }).code ?? '';
    switch (code) {
      case 'auth/invalid-email':
        return 'Email non valida.';
      case 'auth/missing-password':
      case 'auth/weak-password':
        return 'Password mancante o troppo debole (min. 6 caratteri).';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Credenziali non corrette.';
      case 'auth/email-already-in-use':
        return 'Email già registrata: usa "Accedi".';
      default:
        return 'Operazione non riuscita. Riprova.';
    }
  }
}
