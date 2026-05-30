import { Injectable } from '@angular/core';
import { platformFetch } from '../platform/tauri';

/**
 * Cambi valuta da fonti gratuite senza chiave e CORS-friendly (funzionano nel browser):
 * 1) Frankfurter (dati BCE, dominio .dev) — primaria.
 * 2) open.er-api.com — fallback.
 * Usato per convertire in EUR gli strumenti quotati in altra valuta (es. USD).
 */
@Injectable({ providedIn: 'root' })
export class FxProvider {
  readonly id = 'fx';

  /** Tasso di conversione da `from` a `to` (default EUR). Ritorna null se non disponibile. */
  async getRate(from: string, to = 'EUR'): Promise<number | null> {
    const f = from.trim().toUpperCase();
    const t = to.trim().toUpperCase();
    if (f === t) return 1;

    // 1) Frankfurter (BCE)
    try {
      const res = await platformFetch(
        `https://api.frankfurter.dev/v1/latest?base=${f}&symbols=${t}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { rates?: Record<string, number> };
        const r = data.rates?.[t];
        if (typeof r === 'number' && r > 0) return r;
      }
    } catch {
      /* provo il fallback */
    }

    // 2) Fallback: open.er-api.com
    try {
      const res = await platformFetch(`https://open.er-api.com/v6/latest/${f}`);
      if (res.ok) {
        const data = (await res.json()) as { rates?: Record<string, number> };
        const r = data.rates?.[t];
        if (typeof r === 'number' && r > 0) return r;
      }
    } catch {
      /* nessuna fonte disponibile */
    }
    return null;
  }
}
