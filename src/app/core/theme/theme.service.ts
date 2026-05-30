import { effect, Injectable, signal } from '@angular/core';
import { ThemePreference } from '../models';

/**
 * Gestione tema chiaro/scuro. La preferenza ('light' | 'dark' | 'system') è persistita
 * in localStorage e applicata via attributo `data-theme` su <html>. Un piccolo script in
 * index.html applica il tema prima del paint per evitare flicker.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private static readonly KEY = 'zenith-theme';

  readonly preference = signal<ThemePreference>(this.read());
  /** Tema effettivamente applicato dopo aver risolto 'system'. */
  readonly resolved = signal<'light' | 'dark'>('light');

  constructor() {
    effect(() => {
      const pref = this.preference();
      localStorage.setItem(ThemeService.KEY, pref);
      this.apply(pref);
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.preference() === 'system') this.apply('system');
    });
  }

  set(theme: ThemePreference): void {
    this.preference.set(theme);
  }

  /** Alterna tra chiaro e scuro (forzando la preferenza esplicita). */
  toggle(): void {
    this.set(this.resolved() === 'dark' ? 'light' : 'dark');
  }

  private read(): ThemePreference {
    const v = localStorage.getItem(ThemeService.KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  }

  private systemPrefersDark(): boolean {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private apply(pref: ThemePreference): void {
    const dark = pref === 'dark' || (pref === 'system' && this.systemPrefersDark());
    this.resolved.set(dark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
}
