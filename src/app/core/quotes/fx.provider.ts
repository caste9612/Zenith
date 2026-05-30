import { Injectable } from '@angular/core';
import { platformFetch } from '../platform/tauri';

/**
 * Cambi valuta da Frankfurter (dati BCE, senza chiave). Usato per convertire in EUR
 * gli strumenti in altra valuta (es. USD).
 */
@Injectable({ providedIn: 'root' })
export class FxProvider {
  readonly id = 'fx';

  /** Tasso di conversione da `from` a `to` (default EUR). Ritorna null se non disponibile. */
  async getRate(from: string, to = 'EUR'): Promise<number | null> {
    if (from === to) return 1;
    const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const res = await platformFetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: Record<string, number> };
    return data.rates?.[to] ?? null;
  }
}
