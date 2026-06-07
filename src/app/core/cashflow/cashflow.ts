// Aggregazioni del flusso di cassa mensile per la pagina "Cash flow". Funzioni PURE e
// deterministiche → coperte da test (vedi docs/08-testing.md). Importi in EUR; tassi in frazione.

import { CashFlowMonth } from '../models';

/** Tasso di risparmio del mese (saved/income); `null` se l'entrata manca o è ≤ 0. */
export function savingRate(m: CashFlowMonth): number | null {
  if (m.income == null || m.income <= 0 || m.saved == null) return null;
  return m.saved / m.income;
}

/** Risparmio cumulato nel tempo (somma progressiva di `saved`). */
export function cumulativeSaved(months: readonly CashFlowMonth[]): { date: Date; value: number }[] {
  let acc = 0;
  return months.map((m) => {
    acc += m.saved ?? 0;
    return { date: m.date, value: acc };
  });
}

export interface CashFlowYear {
  year: number;
  gross: number;
  income: number;
  expenses: number;
  tax: number;
  saved: number;
  /** Tasso di risparmio annuo (saved/income); `null` se income ≤ 0. */
  rate: number | null;
  /** Netto come frazione residua del lordo cumulato sull'anno (income/gross); `null` se lordo ≤ 0. */
  netRate: number | null;
}

/** Riepilogo per anno (somme dei mesi) + tasso di risparmio annuo, dal più recente. */
export function annualSummary(months: readonly CashFlowMonth[]): CashFlowYear[] {
  const byYear = new Map<number, CashFlowYear>();
  for (const m of months) {
    const y = m.date.getFullYear();
    const cur = byYear.get(y) ?? {
      year: y,
      gross: 0,
      income: 0,
      expenses: 0,
      tax: 0,
      saved: 0,
      rate: null,
      netRate: null,
    };
    cur.gross += m.gross ?? 0;
    cur.income += m.income ?? 0;
    cur.expenses += m.expenses ?? 0;
    cur.tax += m.tax ?? 0;
    cur.saved += m.saved ?? 0;
    byYear.set(y, cur);
  }
  return [...byYear.values()]
    .map((y) => ({
      ...y,
      rate: y.income > 0 ? y.saved / y.income : null,
      netRate: y.gross > 0 ? y.income / y.gross : null,
    }))
    .sort((a, b) => b.year - a.year);
}
