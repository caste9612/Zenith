import { RealizedTrade } from '../models';
import { groupRealizedByYear, realizedTotal } from './realized';

const t = (date: Date, pl: number, kind: 'sale' | 'dividend' = 'sale'): RealizedTrade => ({
  date,
  pl,
  symbol: 'X',
  kind,
  cost: null,
  quantity: null,
  proceeds: null,
  plPct: null,
});

describe('portfolio/realized', () => {
  const trades = [
    t(new Date(2024, 5, 30), 100),
    t(new Date(2024, 2, 31), -20, 'dividend'),
    t(new Date(2023, 11, 31), 50),
  ];

  it('groupRealizedByYear: anni decrescenti, totale per anno, ordine d’ingresso conservato', () => {
    const g = groupRealizedByYear(trades);
    expect(g.map((y) => y.year)).toEqual([2024, 2023]);
    expect(g[0].trades.length).toBe(2);
    expect(g[0].total).toBeCloseTo(80, 10); // 100 + (−20)
    expect(g[1].total).toBe(50);
  });

  it('realizedTotal: somma su tutte le operazioni', () => {
    expect(realizedTotal(trades)).toBeCloseTo(130, 10);
  });

  it('serie vuota → nessun gruppo, totale 0', () => {
    expect(groupRealizedByYear([])).toEqual([]);
    expect(realizedTotal([])).toBe(0);
  });
});
