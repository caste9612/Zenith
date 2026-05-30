import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    title: 'Accedi · Zenith',
    loadComponent: () => import('./features/auth/login').then((m) => m.LoginPage),
  },
  {
    path: 'dashboard',
    title: 'Dashboard · Zenith',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardPage),
  },
  {
    path: 'portfolio',
    title: 'Portafoglio · Zenith',
    canActivate: [authGuard],
    loadComponent: () => import('./features/portfolio/portfolio').then((m) => m.PortfolioPage),
  },
  {
    path: 'portfolio/transaction',
    title: 'Nuova operazione · Zenith',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/portfolio/transaction-form').then((m) => m.TransactionFormPage),
  },
  {
    path: 'portfolio/movimenti',
    title: 'Movimenti · Zenith',
    canActivate: [authGuard],
    loadComponent: () => import('./features/portfolio/movements').then((m) => m.MovementsPage),
  },
  {
    path: 'portfolio/instrument/:id',
    title: 'Strumento · Zenith',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/portfolio/instrument-edit').then((m) => m.InstrumentEditPage),
  },
  {
    path: 'snapshots',
    title: 'Snapshot · Zenith',
    canActivate: [authGuard],
    loadComponent: () => import('./features/snapshots/snapshots').then((m) => m.SnapshotsPage),
  },
  {
    path: 'snapshots/new',
    title: 'Nuovo snapshot · Zenith',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/snapshots/snapshot-editor').then((m) => m.SnapshotEditorPage),
  },
  {
    path: 'snapshots/:id',
    title: 'Modifica snapshot · Zenith',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/snapshots/snapshot-editor').then((m) => m.SnapshotEditorPage),
  },
  {
    path: 'settings',
    title: 'Impostazioni · Zenith',
    canActivate: [authGuard],
    loadComponent: () => import('./features/settings/settings').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: 'dashboard' },
];
