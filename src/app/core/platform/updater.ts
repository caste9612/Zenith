import { Injectable, signal } from '@angular/core';
import type { Update } from '@tauri-apps/plugin-updater';
import { isTauri } from './tauri';

/**
 * Auto-update dell'app **nativa** (Tauri desktop). Il feed sono i GitHub Releases: l'app confronta
 * la propria versione con `latest.json` pubblicato dalla release, e se ce n'è una più recente la
 * scarica, la installa e riavvia. Nel browser/PWA non fa nulla (lì l'aggiornamento è il deploy web).
 *
 * I plugin Tauri sono importati **dinamicamente** e solo dentro Tauri, così non entrano nel percorso
 * del bundle web e non causano errori fuori dall'app nativa.
 */
@Injectable({ providedIn: 'root' })
export class UpdaterService {
  /** Versione disponibile se c'è un aggiornamento pronto, altrimenti null. */
  readonly available = signal<string | null>(null);
  private update: Update | null = null;

  /** Controllo non bloccante all'avvio: solo app nativa; eventuali errori sono silenziosi. */
  async checkOnStartup(): Promise<void> {
    if (!isTauri()) return;
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update?.available) {
        this.update = update;
        this.available.set(update.version);
      }
    } catch {
      // nessun endpoint / offline / updater non disponibile: si ignora
    }
  }

  /** Scarica e installa l'aggiornamento trovato, poi riavvia l'app. */
  async installAndRelaunch(): Promise<void> {
    if (!this.update) return;
    await this.update.downloadAndInstall();
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
  }
}
