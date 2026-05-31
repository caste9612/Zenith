/**
 * Punto mensile dello storico del portafoglio titoli (track record dall'Excel), con il
 * confronto vs benchmark. Un documento per mese in users/{uid}/portfolioHistory (id YYYY-MM).
 * Dati storici di sola lettura: alimentano la pagina "Rendimento".
 */
export interface PortfolioHistoryPoint {
  id?: string; // YYYY-MM
  date: Date; // fine mese
  /** Valore del portafoglio (EUR). */
  value: number;
  /** Capitale investito netto cumulato (EUR). */
  invested: number | null;
  /** Plusvalenze realizzate cumulate (posizioni chiuse, EUR). */
  realized: number | null;
  /** P/L non realizzato delle posizioni aperte nel mese (EUR). */
  openPL: number | null;
  /** Totale (realizzato + non realizzato) come da Excel (EUR). */
  total: number | null;
  /** Dividendi incassati nel mese (EUR). */
  dividends: number | null;
  /** Valore simulato investendo lo stesso flusso nell'S&P 500 (EUR). */
  sp: number | null;
  /** Valore simulato investendo lo stesso flusso nel NASDAQ (EUR). */
  nasdaq: number | null;
}
