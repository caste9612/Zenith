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

// --- Serie storiche (per i grafici "nel tempo") -------------------------------------------
// Costruite dai mesi degli snapshot (già ordinati per data). Pure e testate: la UI le mappa
// solo in input per i grafici. I valori sono allineati per indice all'array `labels`.

/** Campi di uno Snapshot che servono alle serie storiche. */
export interface BalanceSnapshot {
  date: Date;
  values: ValueMap;
  savingRate?: number;
}

/** Etichette + valori per chiave allineati ai mesi (0 dove la chiave è assente in quel mese). */
export interface KeyedSeries<K> {
  labels: Date[];
  byKey: Map<K, number[]>;
}

function keyedSeries<K>(
  snapshots: readonly BalanceSnapshot[],
  totalsOf: (s: BalanceSnapshot) => Map<K, number>,
): KeyedSeries<K> {
  const labels = snapshots.map((s) => s.date);
  const perMonth = snapshots.map(totalsOf);
  const keys = new Set<K>();
  for (const m of perMonth) for (const k of m.keys()) keys.add(k);
  const byKey = new Map<K, number[]>();
  for (const k of keys)
    byKey.set(
      k,
      perMonth.map((m) => m.get(k) ?? 0),
    );
  return { labels, byKey };
}

/** Ripartizione per classe di asset (solo asset positivi) mese per mese. */
export function assetClassSeries(
  accounts: readonly BalanceAccount[],
  snapshots: readonly BalanceSnapshot[],
): KeyedSeries<AssetClass> {
  return keyedSeries(snapshots, (s) =>
    totalsByAssetClass(accounts, s.values, { assetsOnly: true }),
  );
}

/** Patrimonio per intestatario mese per mese (totali con segno: le passività sottraggono). */
export function ownerSeries(
  accounts: readonly BalanceAccount[],
  snapshots: readonly BalanceSnapshot[],
): KeyedSeries<Owner> {
  return keyedSeries(snapshots, (s) => totalsByOwner(accounts, s.values));
}

/** Valore di una singola voce nel tempo (0 nei mesi senza quel valore). */
export function accountSeries(
  accountId: string,
  snapshots: readonly BalanceSnapshot[],
): { date: Date; value: number }[] {
  return snapshots.map((s) => ({ date: s.date, value: s.values[accountId] ?? 0 }));
}

/** Tasso di risparmio (frazione 0..1) nel tempo; `null` nei mesi senza dato. */
export function savingRateSeries(snapshots: readonly BalanceSnapshot[]): {
  labels: Date[];
  values: (number | null)[];
} {
  return {
    labels: snapshots.map((s) => s.date),
    values: snapshots.map((s) => s.savingRate ?? null),
  };
}

/**
 * Tasso di risparmio "basato sul patrimonio": crescita % del patrimonio netto mese su mese →
 * `values[i] = (NW[i] − NW[i-1]) / NW[i-1]`. Un trasferimento tra conti non cambia il patrimonio,
 * quindi (a differenza del cash flow) NON appare come spesa. `null` dove non calcolabile (primo
 * mese, o patrimonio precedente ≤ 0). Con `owner` limita a un intestatario; senza, l'intero nucleo.
 */
export function netWorthGrowthSeries(
  accounts: readonly BalanceAccount[],
  snapshots: readonly BalanceSnapshot[],
  owner?: Owner,
): { labels: Date[]; values: (number | null)[] } {
  const sel = owner ? accounts.filter((a) => a.owner === owner) : accounts;
  const nw = snapshots.map((s) => computeNetWorth(sel, s.values));
  return {
    labels: snapshots.map((s) => s.date),
    values: nw.map((v, i) => {
      if (i === 0) return null;
      const prev = nw[i - 1];
      return prev > 0 ? (v - prev) / prev : null;
    }),
  };
}
