import { Instrument } from '../models';
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
