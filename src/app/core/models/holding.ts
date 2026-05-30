/** Modalità di prezzo della posizione: automatica (da QuoteProvider) o manuale. */
export type PriceMode = 'auto' | 'manual';

/**
 * Posizione in un titolo: quantità detenuta e prezzo medio di carico (PMC).
 * Confluisce nel valore della voce "Azionario"/"Crypto" del patrimonio.
 */
export interface Holding {
  id?: string;
  /** Voce di patrimonio a cui appartiene la posizione (es. l'account "Azionario"). */
  accountId: string;
  instrumentId: string;
  quantity: number;
  /** Prezzo medio di carico (PMC) nella valuta dello strumento. */
  avgCost: number;
  /** Valuta della posizione (di norma quella dello strumento). */
  currency: string;
  priceMode: PriceMode;
  /** Prezzo usato se priceMode = 'manual'. */
  manualPrice?: number;
  openedAt?: Date;
  notes?: string;
}
