/** Tipo di strumento finanziario. */
export type AssetType = 'equity' | 'etf' | 'bond' | 'crypto' | 'fx' | 'other';

/** Quale fonte aggiorna la quotazione dello strumento. */
export type QuoteProviderId = 'finnhub' | 'alphavantage' | 'yahoo' | 'fx' | 'manual';

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  equity: 'Azione',
  etf: 'ETF',
  bond: 'Obbligazione',
  crypto: 'Crypto',
  fx: 'Cambio',
  other: 'Altro',
};

/**
 * Anagrafica di un titolo + cache dell'ultima quotazione.
 * Per i titoli a prezzo manuale (BTP/bond, quota del fondo crypto) `provider = 'manual'`
 * e si usa `manualPrice` con `manualPriceAt`.
 */
export interface Instrument {
  id?: string;
  /** Ticker usato dal provider (per provider 'auto'). */
  symbol: string;
  isin?: string;
  name: string;
  assetType: AssetType;
  /** Valuta di quotazione dello strumento (es. EUR, USD). */
  currency: string;
  provider: QuoteProviderId;

  // --- cache quotazione automatica ---
  lastPrice?: number;
  /** Chiusura del giorno precedente (per la variazione a 1 giorno). */
  prevClose?: number;
  lastPriceAt?: Date;

  // --- prezzo manuale (BTP/bond e simili) ---
  manualPrice?: number;
  manualPriceAt?: Date;

  notes?: string;
}
