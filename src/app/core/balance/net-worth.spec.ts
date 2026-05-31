import { AssetClass, Owner } from '../models';
import {
  BalanceAccount,
  computeNetWorth,
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
