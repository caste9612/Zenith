// Indicatori di performance del portafoglio, calcolati dal track record mensile
// (PortfolioHistoryPoint). Funzioni PURE e deterministiche → coperte da test
// (vedi docs/08-testing.md). Valori in frazione (0,12 = 12%).

import { PortfolioHistoryPoint } from '../models/portfolio-history';

/** Mesi in un anno, per l'annualizzazione. */
const MONTHS_PER_YEAR = 12;

/** Tasso risk-free annuo usato per lo Sharpe (semplificazione: 0%). Modificabile. */
export const RISK_FREE_ANNUAL = 0;

/**
 * Rendimenti mensili **time-weighted**: scorpora il flusso netto (acquisti − vendite)
 * di ogni mese, così la serie misura la performance dei titoli e non quanto capitale è
 * stato immesso. Per ogni coppia di mesi consecutivi:
 *
 *   guadagno = (Δvalore − flusso) + Δrealizzato + dividendi
 *   rendimento = guadagno / capitale investito a inizio mese
 *
 * I mesi in cui non c'è capitale investito (base ≤ 0) sono saltati: il rendimento non è definito.
 */
export function monthlyReturns(points: PortfolioHistoryPoint[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const base = prev.invested ?? 0;
    if (base <= 0) continue;
    const flow = (cur.invested ?? 0) - (prev.invested ?? 0);
    const unrealized = cur.value - prev.value - flow;
    const realizedDelta = (cur.realized ?? 0) - (prev.realized ?? 0);
    const dividends = cur.dividends ?? 0;
    out.push((unrealized + realizedDelta + dividends) / base);
  }
  return out;
}

/** Media aritmetica (0 su serie vuota). */
export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Deviazione standard campionaria (denominatore n−1). 0 con meno di 2 valori. */
export function sampleStdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/** Volatilità annualizzata: dev. std mensile × √12. */
export function annualizedVolatility(returns: number[]): number {
  return sampleStdDev(returns) * Math.sqrt(MONTHS_PER_YEAR);
}

/**
 * Sharpe ratio annualizzato. rf annuo convertito in mensile; 0 se la volatilità è nulla
 * (serie piatta) per evitare la divisione per zero.
 */
export function sharpeRatio(returns: number[], riskFreeAnnual = RISK_FREE_ANNUAL): number {
  const sd = sampleStdDev(returns);
  if (sd === 0) return 0;
  const excessMean = mean(returns) - riskFreeAnnual / MONTHS_PER_YEAR;
  return (excessMean / sd) * Math.sqrt(MONTHS_PER_YEAR);
}

/** Indice di crescita composto a partire da 1 (es. [1, 1+r1, (1+r1)(1+r2), …]). */
export function cumulativeIndex(returns: number[]): number[] {
  const idx = [1];
  for (const r of returns) idx.push(idx[idx.length - 1] * (1 + r));
  return idx;
}

/** CAGR (rendimento annuo composto) dai rendimenti mensili. */
export function cagr(returns: number[]): number {
  if (returns.length === 0) return 0;
  const growth = returns.reduce((acc, r) => acc * (1 + r), 1);
  const years = returns.length / MONTHS_PER_YEAR;
  if (growth <= 0) return -1; // perdita totale del capitale
  return growth ** (1 / years) - 1;
}

/**
 * Massimo drawdown: massima discesa da un picco precedente, sull'indice composto.
 * Ritorna una frazione **positiva** (0,2 = caduta del 20% dal massimo).
 */
export function maxDrawdown(returns: number[]): number {
  const idx = cumulativeIndex(returns);
  let peak = idx[0];
  let worst = 0;
  for (const v of idx) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? (peak - v) / peak : 0;
    if (dd > worst) worst = dd;
  }
  return worst;
}

// --- Indicatori su una serie di VALORI (es. patrimonio netto) -----------------------------
// A differenza del track record del portafoglio (dove monthlyReturns scorpora i flussi per
// isolare la performance dei titoli), qui i "rendimenti" sono semplici variazioni periodo su
// periodo del valore. Adatto a una serie come il patrimonio netto, dove apporti e rendimento
// non sono distinguibili: misura la CRESCITA del valore, non un rendimento risk-adjusted —
// per questo niente Sharpe (sarebbe fuorviante, includerebbe i risparmi versati).

/** Variazioni relative tra valori consecutivi; salta i passi con base ≤ 0 (non definiti). */
export function valueReturns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const base = values[i - 1];
    if (base <= 0) continue;
    out.push((values[i] - base) / base);
  }
  return out;
}

/** Indicatori di una serie di valori mensili (es. patrimonio netto). */
export interface SeriesMetrics {
  /** Variazioni usate (punti − 1, al netto dei passi con base ≤ 0). */
  steps: number;
  /** Crescita annua composta del valore (CAGR). */
  cagr: number;
  /** Volatilità annualizzata delle variazioni mensili. */
  volatility: number;
  /** Massima caduta dal picco (frazione positiva, 0,2 = −20%). */
  maxDrawdown: number;
}

/** Calcola gli indicatori di crescita da una serie di valori mensili (mensile = annualizza ×√12). */
export function seriesMetrics(values: number[]): SeriesMetrics {
  const r = valueReturns(values);
  return {
    steps: r.length,
    cagr: cagr(r),
    volatility: annualizedVolatility(r),
    maxDrawdown: maxDrawdown(r),
  };
}

/** Riepilogo degli indicatori per la UI. */
export interface PortfolioMetrics {
  /** Numero di rendimenti mensili usati (mesi − 1, al netto dei mesi senza capitale). */
  months: number;
  cagr: number;
  volatility: number;
  sharpe: number;
  /** Frazione positiva (0,2 = −20%). */
  maxDrawdown: number;
}

/** Calcola tutti gli indicatori dal track record mensile. */
export function computeMetrics(
  points: PortfolioHistoryPoint[],
  riskFreeAnnual = RISK_FREE_ANNUAL,
): PortfolioMetrics {
  const r = monthlyReturns(points);
  return {
    months: r.length,
    cagr: cagr(r),
    volatility: annualizedVolatility(r),
    sharpe: sharpeRatio(r, riskFreeAnnual),
    maxDrawdown: maxDrawdown(r),
  };
}
