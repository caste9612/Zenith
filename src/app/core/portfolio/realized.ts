// Aggregazioni delle operazioni chiuse (RealizedTrade) per la pagina Rendimento. Funzioni PURE
// e deterministiche → coperte da test (vedi docs/08-testing.md).

import { RealizedTrade } from '../models';

export interface RealizedYear {
  year: number;
  trades: RealizedTrade[];
  /** Somma del P/L realizzato dell'anno (EUR). */
  total: number;
}

/** Raggruppa le operazioni per anno (anno **decrescente**; dentro, l'ordine d'ingresso è conservato). */
export function groupRealizedByYear(trades: readonly RealizedTrade[]): RealizedYear[] {
  const byYear = new Map<number, RealizedTrade[]>();
  for (const t of trades) {
    const y = t.date.getFullYear();
    const arr = byYear.get(y);
    if (arr) arr.push(t);
    else byYear.set(y, [t]);
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, ts]) => ({ year, trades: ts, total: ts.reduce((s, t) => s + (t.pl ?? 0), 0) }));
}

/** P/L realizzato totale (somma su tutte le operazioni). */
export function realizedTotal(trades: readonly RealizedTrade[]): number {
  return trades.reduce((s, t) => s + (t.pl ?? 0), 0);
}
