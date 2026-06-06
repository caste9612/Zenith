import { PortfolioHistoryPoint } from '../models/portfolio-history';
import {
  annualizedVolatility,
  cagr,
  computeMetrics,
  cumulativeIndex,
  maxDrawdown,
  mean,
  monthlyReturns,
  sampleStdDev,
  seriesMetrics,
  sharpeRatio,
  valueReturns,
} from './metrics';

/** Costruisce un punto del track record con i soli campi rilevanti per gli indicatori. */
function pt(
  partial: Partial<PortfolioHistoryPoint> & { value: number; invested: number },
): PortfolioHistoryPoint {
  return {
    date: new Date(2024, 0, 1),
    realized: 0,
    openPL: null,
    total: null,
    dividends: 0,
    sp: null,
    nasdaq: null,
    ...partial,
  };
}

describe('metrics · funzioni statistiche', () => {
  it('mean: media aritmetica, 0 su serie vuota', () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([])).toBe(0);
  });

  it('sampleStdDev: deviazione standard campionaria (n−1), 0 sotto 2 valori', () => {
    expect(sampleStdDev([2, 4])).toBeCloseTo(1.41421356, 6);
    expect(sampleStdDev([3, 3, 3])).toBe(0);
    expect(sampleStdDev([5])).toBe(0);
    expect(sampleStdDev([])).toBe(0);
  });

  it('cumulativeIndex: indice composto a partire da 1', () => {
    const idx = cumulativeIndex([0.1, -0.1]);
    expect(idx[0]).toBe(1);
    expect(idx[1]).toBeCloseTo(1.1, 10);
    expect(idx[2]).toBeCloseTo(0.99, 10);
  });
});

describe('metrics · rendimenti mensili (time-weighted)', () => {
  it('rendimento puro senza flussi', () => {
    const r = monthlyReturns([
      pt({ value: 100, invested: 100 }),
      pt({ value: 110, invested: 100 }),
      pt({ value: 99, invested: 100 }),
    ]);
    expect(r.length).toBe(2);
    expect(r[0]).toBeCloseTo(0.1, 10); // +10 su 100
    expect(r[1]).toBeCloseTo(-0.11, 10); // 99 da 110 → −11 su base 100
  });

  it('scorpora il flusso netto (un versamento non è un guadagno)', () => {
    // +100 immessi e +10 di vera crescita → r = 10/100 = 0,10
    const r = monthlyReturns([
      pt({ value: 100, invested: 100 }),
      pt({ value: 210, invested: 200 }),
    ]);
    expect(r[0]).toBeCloseTo(0.1, 10);
  });

  it('una vendita a prezzo di mercato non crea nuovo guadagno', () => {
    // Vendo una posizione da 15 di valore (costo 10, +5 già in openPL):
    // value 100→85, invested 100→90, realized 0→5 ⇒ r = 0
    const r = monthlyReturns([
      pt({ value: 100, invested: 100, realized: 0 }),
      pt({ value: 85, invested: 90, realized: 5 }),
    ]);
    expect(r[0]).toBeCloseTo(0, 10);
  });

  it('i dividendi contano come rendimento', () => {
    const r = monthlyReturns([
      pt({ value: 90, invested: 90 }),
      pt({ value: 90, invested: 90, dividends: 3 }),
    ]);
    expect(r[0]).toBeCloseTo(3 / 90, 10);
  });

  it('salta i mesi senza capitale a inizio periodo (base ≤ 0)', () => {
    const r = monthlyReturns([
      pt({ value: 0, invested: 0 }),
      pt({ value: 50, invested: 50 }),
      pt({ value: 55, invested: 50 }),
    ]);
    expect(r.length).toBe(1); // il primo passo (base 0) è saltato
    expect(r[0]).toBeCloseTo(0.1, 10); // 55 da 50 → +10%
  });
});

describe('metrics · indicatori', () => {
  it('annualizedVolatility: dev. std mensile × √12', () => {
    const r = [0.1, -0.11];
    expect(annualizedVolatility(r)).toBeCloseTo(sampleStdDev(r) * Math.sqrt(12), 12);
  });

  it('sharpeRatio: segno coerente e 0 se la serie è piatta', () => {
    expect(sharpeRatio([0.1, -0.11])).toBeLessThan(0); // rendimento medio negativo
    expect(sharpeRatio([0.05, 0.05])).toBe(0); // dev. std 0 → niente divisione per zero
  });

  it('sharpeRatio: con rf=0 è media/dev.std annualizzato', () => {
    const r = [0.02, 0.03, 0.01, 0.04];
    expect(sharpeRatio(r, 0)).toBeCloseTo((mean(r) / sampleStdDev(r)) * Math.sqrt(12), 12);
  });

  it('sharpeRatio: il risk-free riduce l’eccesso di rendimento', () => {
    const r = [0.02, 0.03, 0.01, 0.04];
    expect(sharpeRatio(r, 0.12)).toBeLessThan(sharpeRatio(r, 0));
  });

  it('cagr: rendimento annuo composto', () => {
    expect(cagr([])).toBe(0);
    // 12 mesi a +1% → (1,01)^12 − 1
    expect(cagr(Array(12).fill(0.01))).toBeCloseTo(1.01 ** 12 - 1, 10);
    // perdita totale in un mese → −100%
    expect(cagr([-1])).toBe(-1);
  });

  it('maxDrawdown: massima caduta dal picco (frazione positiva)', () => {
    // indice [1, 1.1, 0.55, 0.66] → max caduta (1.1−0.55)/1.1 = 0.5
    expect(maxDrawdown([0.1, -0.5, 0.2])).toBeCloseTo(0.5, 10);
    expect(maxDrawdown([0.1, 0.1])).toBe(0); // serie monotona crescente
  });

  it('computeMetrics: aggrega tutto e conta i mesi usati', () => {
    const points = [
      pt({ value: 100, invested: 100 }),
      pt({ value: 110, invested: 100 }),
      pt({ value: 99, invested: 100 }),
    ];
    const r = monthlyReturns(points);
    const m = computeMetrics(points);
    expect(m.months).toBe(2);
    expect(m.cagr).toBeCloseTo(cagr(r), 12);
    expect(m.volatility).toBeCloseTo(annualizedVolatility(r), 12);
    expect(m.sharpe).toBeCloseTo(sharpeRatio(r), 12);
    // indice [1, 1.1, 1.1·0.89=0.979] → caduta (1.1−0.979)/1.1 = 0.11
    expect(m.maxDrawdown).toBeCloseTo(0.11, 10);
  });
});

describe('metrics · serie di valori (patrimonio netto)', () => {
  it('valueReturns: variazioni periodo su periodo', () => {
    const r = valueReturns([100, 110, 99]);
    expect(r.length).toBe(2);
    expect(r[0]).toBeCloseTo(0.1, 10); // +10 su 100
    expect(r[1]).toBeCloseTo(-0.1, 10); // 99 da 110 → −10%
  });

  it('valueReturns: salta i passi con base ≤ 0', () => {
    const r = valueReturns([0, 50, 55]);
    expect(r.length).toBe(1); // il passo con base 0 è saltato
    expect(r[0]).toBeCloseTo(0.1, 10);
  });

  it('seriesMetrics: CAGR/volatilità/maxDrawdown coerenti con le primitive', () => {
    const values = [100, 110, 99];
    const r = valueReturns(values);
    const m = seriesMetrics(values);
    expect(m.steps).toBe(2);
    expect(m.cagr).toBeCloseTo(cagr(r), 12);
    expect(m.volatility).toBeCloseTo(annualizedVolatility(r), 12);
    // indice [1, 1.1, 0.99] → caduta (1.1−0.99)/1.1 = 0.1
    expect(m.maxDrawdown).toBeCloseTo(0.1, 10);
  });

  it('seriesMetrics: serie troppo corta → nessuna variazione, indicatori a zero', () => {
    const m = seriesMetrics([100]);
    expect(m.steps).toBe(0);
    expect(m.cagr).toBe(0);
    expect(m.volatility).toBe(0);
    expect(m.maxDrawdown).toBe(0);
  });
});
