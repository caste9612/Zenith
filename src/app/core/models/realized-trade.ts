/**
 * Operazione **chiusa** (storica, importata dall'Excel): una posizione venduta o un dividendo
 * incassato, col P/L realizzato. Sola lettura; aggiunge il **dettaglio** dietro al realizzato
 * aggregato già in `portfolioHistory`. Un documento per operazione in users/{uid}/realizedTrades.
 */
export interface RealizedTrade {
  id?: string; // YYYY-MM-n (deterministico → idempotente)
  date: Date; // fine mese dell'operazione
  symbol: string; // ticker (per i dividendi, il titolo che li ha pagati)
  kind: 'sale' | 'dividend';
  cost: number | null; // costo della posizione (null per i dividendi)
  quantity: number | null; // quantità (null per i dividendi)
  proceeds: number | null; // ricavo lordo dell'operazione ("utile" nell'Excel)
  pl: number; // P/L realizzato in EUR (anche per i dividendi)
  plPct: number | null; // P/L come frazione (0,12 = +12%); null per i dividendi
}
