import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

/** true quando l'app gira dentro la webview nativa di Tauri (desktop/Android). */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * fetch che usa il layer HTTP nativo di Tauri (niente CORS) quando disponibile,
 * altrimenti il fetch del browser. È la base per chiamare le API di mercato sia
 * su desktop/Android (Tauri) sia in sviluppo nel browser.
 */
export async function platformFetch(input: string, init?: RequestInit): Promise<Response> {
  if (isTauri()) {
    return tauriFetch(input, init);
  }
  return fetch(input, init);
}
