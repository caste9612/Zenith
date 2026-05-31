// Calcoli del patrimonio netto (balance sheet) come funzioni PURE e deterministiche →
// coperte da test (vedi docs/08-testing.md). Usate da dashboard, editor snapshot e import.
// Le passività (isLiability) sottraggono; le altre voci sommano.

import { AssetClass, Owner } from '../models';

/** Sottoinsieme dei campi di Account che servono ai calcoli del netto. */
export interface BalanceAccount {
  id?: string;
  owner: Owner;
  assetClass: AssetClass;
  isLiability: boolean;
}

/** Valori per voce in uno snapshot: id voce → importo (EUR). */
export type ValueMap = Record<string, number>;

const valueOf = (a: BalanceAccount, values: ValueMap): number => values[a.id ?? ''] ?? 0;
const signed = (a: BalanceAccount, values: ValueMap): number =>
  a.isLiability ? -valueOf(a, values) : valueOf(a, values);

/** Patrimonio netto = somma degli asset − somma delle passività. */
export function computeNetWorth(accounts: readonly BalanceAccount[], values: ValueMap): number {
  return accounts.reduce((sum, a) => sum + signed(a, values), 0);
}

/** Totale per intestatario (le passività sottraggono). */
export function totalsByOwner(
  accounts: readonly BalanceAccount[],
  values: ValueMap,
): Map<Owner, number> {
  const out = new Map<Owner, number>();
  for (const a of accounts) out.set(a.owner, (out.get(a.owner) ?? 0) + signed(a, values));
  return out;
}

/**
 * Totale per classe di asset. Con `assetsOnly` (default false) esclude passività e importi ≤ 0:
 * adatto alla torta dell'allocazione (solo asset positivi). Senza, le passività sottraggono.
 */
export function totalsByAssetClass(
  accounts: readonly BalanceAccount[],
  values: ValueMap,
  opts: { assetsOnly?: boolean } = {},
): Map<AssetClass, number> {
  const out = new Map<AssetClass, number>();
  for (const a of accounts) {
    if (opts.assetsOnly && a.isLiability) continue;
    const v = valueOf(a, values);
    if (opts.assetsOnly && v <= 0) continue;
    out.set(a.assetClass, (out.get(a.assetClass) ?? 0) + (opts.assetsOnly ? v : signed(a, values)));
  }
  return out;
}
