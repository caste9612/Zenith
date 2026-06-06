import { Instrument, QuoteProviderId } from '../models';
import { Quote } from './quote';

/**
 * Astrazione di una fonte di quotazioni (strategy pattern).
 * Permette di aggiungere/cambiare fonti (Finnhub, FX, future API per BTP…)
 * senza toccare il resto dell'app.
 */
export interface QuoteProvider {
  readonly id: string;
  /** true se questo provider sa quotare lo strumento dato. */
  supports(instrument: Instrument): boolean;
  /** Ritorna la quotazione, o null se non disponibile. */
  getQuote(instrument: Instrument): Promise<Quote | null>;
  /**
   * Intervallo minimo (ms) tra due chiamate consecutive a questo provider, per rispettare i
   * limiti di burst del piano free (es. Alpha Vantage: max 1 richiesta/secondo). Se assente o 0,
   * nessuna attesa. Il refresh distanzia le chiamate allo stesso provider di conseguenza.
   */
  readonly minIntervalMs?: number;
}

/**
 * Il simbolo da usare per interrogare un certo provider, o `undefined` se quel provider non è
 * previsto per lo strumento. Risolve la mappa `providerSymbols`; in mancanza, usa `symbol` solo se
 * il provider è quello "primario" dello strumento. Conseguenze:
 *  - titoli "legacy" (solo `symbol` + `provider`) → quotabili solo dal loro unico provider;
 *  - titoli con `providerSymbols` → quotabili da ogni provider elencato (abilita catena e fallback).
 */
export function symbolForProvider(
  instrument: Instrument,
  providerId: QuoteProviderId,
): string | undefined {
  const mapped = instrument.providerSymbols?.[providerId];
  if (mapped && mapped.trim()) return mapped.trim();
  if (instrument.provider === providerId) return instrument.symbol;
  return undefined;
}
