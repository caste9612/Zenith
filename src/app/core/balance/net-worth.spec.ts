import { AssetClass, Owner } from '../models';
import {
  accountSeries,
  assetClassSeries,
  BalanceAccount,
  BalanceSnapshot,
  computeNetWorth,
  netWorthGrowthSeries,
  ownerSeries,
  savingRateSeries,
  totalsByAssetClass,
  totalsByOwner,
  ValueMap,
} from './net-worth';

/** Crea una voce di bilancio minimale per i test. */
function acc(
  id: string,
  owner: Owner,
  assetClass: AssetClass,
  isLiability = false,
): BalanceAccount {
  return { id, owner, assetClass, isLiability };
}

describe('balance/net-worth', () => {
  const accounts: BalanceAccount[] = [
    acc('a', 'antonio', 'equity'),
    acc('b', 'antonio', 'cash'),
    acc('m', 'michela', 'pension'),
    acc('s', 'shared', 'cash'),
    acc('mutuo', 'shared', 'liability', true),
  ];
  const values: ValueMap = { a: 1000, b: 500, m: 2000, s: 300, mutuo: 800 };

  it('computeNetWorth: asset − passività', () => {
    // 1000 + 500 + 2000 + 300 − 800 = 3000
    expect(computeNetWorth(accounts, values)).toBe(3000);
  });

  it('computeNetWorth: voce senza valore conta 0', () => {
    expect(computeNetWorth([acc('x', 'antonio', 'cash')], {})).toBe(0);
  });

  it('totalsByOwner: aggrega per intestatario, passività sottraggono', () => {
    const t = totalsByOwner(accounts, values);
    expect(t.get('antonio')).toBe(1500); // 1000 + 500
    expect(t.get('michela')).toBe(2000);
    expect(t.get('shared')).toBe(-500); // 300 − 800 (mutuo)
  });

  it('totalsByAssetClass (default): le passività sottraggono nella loro classe', () => {
    const t = totalsByAssetClass(accounts, values);
    expect(t.get('cash')).toBe(800); // 500 + 300
    expect(t.get('equity')).toBe(1000);
    expect(t.get('liability')).toBe(-800);
  });

  it('totalsByAssetClass (assetsOnly): esclude passività e importi ≤ 0', () => {
    const withZero = [...accounts, acc('z', 'antonio', 'reserve')];
    const t = totalsByAssetClass(withZero, { ...values, z: 0 }, { assetsOnly: true });
    expect(t.get('cash')).toBe(800);
    expect(t.get('equity')).toBe(1000);
    expect(t.has('liability')).toBe(false); // passività escluse
    expect(t.has('reserve')).toBe(false); // importo 0 escluso
  });
});

describe('balance/net-worth · serie storiche', () => {
  const accounts: BalanceAccount[] = [
    acc('a', 'antonio', 'equity'),
    acc('c', 'antonio', 'cash'),
    acc('m', 'michela', 'pension'),
  ];
  const snaps: BalanceSnapshot[] = [
    { date: new Date(2024, 0, 31), values: { a: 100, c: 50, m: 200 }, savingRate: 0.2 },
    { date: new Date(2024, 1, 29), values: { a: 120, c: 60, m: 210 } },
    { date: new Date(2024, 2, 31), values: { a: 0, c: 80, m: 220 }, savingRate: 0.3 },
  ];

  it('assetClassSeries: valori per classe allineati ai mesi (assetsOnly esclude ≤ 0)', () => {
    const { labels, byKey } = assetClassSeries(accounts, snaps);
    expect(labels.length).toBe(3);
    expect(byKey.get('equity')).toEqual([100, 120, 0]); // 3° mese a=0 → escluso → 0
    expect(byKey.get('cash')).toEqual([50, 60, 80]);
    expect(byKey.get('pension')).toEqual([200, 210, 220]);
  });

  it('ownerSeries: aggrega per intestatario nel tempo', () => {
    const { byKey } = ownerSeries(accounts, snaps);
    expect(byKey.get('antonio')).toEqual([150, 180, 80]); // a + c
    expect(byKey.get('michela')).toEqual([200, 210, 220]);
  });

  it('accountSeries: valore di una voce nel tempo (0 dove assente)', () => {
    expect(accountSeries('a', snaps).map((p) => p.value)).toEqual([100, 120, 0]);
    expect(accountSeries('ignota', snaps).map((p) => p.value)).toEqual([0, 0, 0]);
  });

  it('savingRateSeries: frazioni con null dove manca il dato', () => {
    const { labels, values } = savingRateSeries(snaps);
    expect(labels.length).toBe(3);
    expect(values).toEqual([0.2, null, 0.3]);
  });

  it('netWorthGrowthSeries: crescita % del patrimonio, primo mese null', () => {
    // Nucleo: 350 → 390 → 300
    const all = netWorthGrowthSeries(accounts, snaps);
    expect(all.labels.length).toBe(3);
    expect(all.values[0]).toBeNull();
    expect(all.values[1]!).toBeCloseTo(40 / 350, 10);
    expect(all.values[2]!).toBeCloseTo(-90 / 390, 10);
    expect(all.deltas).toEqual([null, 40, -90]); // variazione assoluta in €

    // Per intestatario (Antonio): 150 → 180 → 80
    const ant = netWorthGrowthSeries(accounts, snaps, 'antonio');
    expect(ant.values[0]).toBeNull();
    expect(ant.values[1]!).toBeCloseTo(0.2, 10);
    expect(ant.values[2]!).toBeCloseTo(-100 / 180, 10);
    expect(ant.deltas).toEqual([null, 30, -100]);
  });

  it('netWorthGrowthSeries: null quando il patrimonio precedente è ≤ 0', () => {
    const a2 = [acc('x', 'antonio', 'cash')];
    const s2: BalanceSnapshot[] = [
      { date: new Date(2024, 0, 31), values: { x: 0 } },
      { date: new Date(2024, 1, 29), values: { x: 100 } },
      { date: new Date(2024, 2, 31), values: { x: 150 } },
    ];
    const { values, deltas } = netWorthGrowthSeries(a2, s2);
    expect(values[0]).toBeNull(); // primo mese
    expect(values[1]).toBeNull(); // base 0 → null (% non calcolabile)
    expect(values[2]!).toBeCloseTo(0.5, 10); // 100 → 150
    expect(deltas).toEqual([null, 100, 50]); // l'assoluto in € resta calcolabile
  });
});
