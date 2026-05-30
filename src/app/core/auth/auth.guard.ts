import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Protegge le rotte applicative.
 * - Se Firebase non è configurato: lascia passare (così si vede lo shell/design in sviluppo,
 *   con un banner "da configurare").
 * - Se configurato ma non loggati: redirect a /login.
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.configured) return true;

  await auth.whenReady();
  if (auth.isLoggedIn()) return true;

  return router.createUrlTree(['/login']);
};
