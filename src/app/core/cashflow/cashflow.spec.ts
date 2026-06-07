import { CashFlowMonth } from '../models';
import { annualSummary, cumulativeSaved, savingRate } from './cashflow';

const m = (
  date: Date,
  income: number | null,
  expenses: number | null,
  extra: Partial<CashFlowMonth> = {},
): CashFlowMonth => ({
  date,
  gross: null,
  tax: null,
  income,
  expenses,
  saved: income != null && expenses != null ? income - expenses : null,
  ...extra,
});

describe('cashflow', () => {
  it('savingRate: saved/income; null se income manca o ≤ 0', () => {
    expect(savingRate(m(new Date(2024, 0, 31), 1000, 600))).toBeCloseTo(0.4, 10); // 400/1000
    expect(savingRate(m(new Date(2024, 0, 31), 0, 0))).toBeNull();
    expect(savingRate(m(new Date(2024, 0, 31), null, 100))).toBeNull();
  });

  it('cumulativeSaved: somma progressiva del risparmio', () => {
    const series = cumulativeSaved([
      m(new Date(2024, 0, 31), 1000, 600), // saved 400
      m(new Date(2024, 1, 29), 1000, 900), // saved 100 → cum 500
      m(new Date(2024, 2, 31), 1000, 1100), // saved −100 → cum 400
    ]);
    expect(series.map((p) => p.value)).toEqual([400, 500, 400]);
  });

  it('annualSummary: somme per anno + tasso, anni decrescenti', () => {
    const s = annualSummary([
      m(new Date(2023, 11, 31), 1000, 600, { gross: 1300, tax: 300 }), // 2023: saved 400
      m(new Date(2024, 0, 31), 1000, 500, { gross: 1300, tax: 300 }), // 2024: saved 500
      m(new Date(2024, 1, 29), 1000, 700, { gross: 1300, tax: 300 }), // 2024: saved 300
    ]);
    expect(s.map((y) => y.year)).toEqual([2024, 2023]);
    expect(s[0].income).toBe(2000);
    expect(s[0].saved).toBe(800); // 500 + 300
    expect(s[0].rate).toBeCloseTo(0.4, 10); // 800/2000
    expect(s[1].saved).toBe(400);
  });
});
