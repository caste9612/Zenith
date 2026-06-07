// Shaping PURO dei dati dell'app → righe di un foglio Excel. Niente ExcelJS qui (così è testabile):
// l'ExportService rende questi SheetData in un workbook. Vedi docs/08-testing.md.

import type { Account, Holding, Instrument, Owner, Snapshot } from '../models';
import { computeNetWorth, totalsByOwner } from '../balance/net-worth';

/** Un foglio pronto da rendere: intestazioni + righe + indici colonna per i formati. */
export interface SheetData {
  name: string;
  headers: string[];
  rows: (string | number | Date | null)[][];
  /** Indici colonna (0-based) con formato euro. */
  eurColumns?: number[];
  /** Indici colonna con frazione → percentuale. */
  pctColumns?: number[];
  /** Indici colonna con formato data (mese). */
  dateColumns?: number[];
}

const ownerRank: Record<Owner, number> = { antonio: 0, michela: 1, shared: 2 };

/**
 * Foglio "Patrimonio" (≈ foglio Amorini dell'Excel): un mese per riga, una colonna per voce
 * (ordinate per intestatario), più i subtotali per intestatario e il **Totale netto**.
 */
export function patrimonioSheet(
  accounts: readonly Account[],
  snapshots: readonly Snapshot[],
): SheetData {
  const cols = [...accounts].sort(
    (a, b) => ownerRank[a.owner] - ownerRank[b.owner] || (a.order ?? 0) - (b.order ?? 0),
  );
  const headers = [
    'Mese',
    ...cols.map((a) => a.name),
    'Tot. Antonio',
    'Tot. Michela',
    'Tot. Condiviso',
    'Totale netto',
  ];
  const rows = snapshots.map((s) => {
    const owner = totalsByOwner(accounts, s.values);
    return [
      s.date,
      ...cols.map((a) => s.values[a.id ?? ''] ?? null),
      owner.get('antonio') ?? null,
      owner.get('michela') ?? null,
      owner.get('shared') ?? null,
      s.netWorth ?? computeNetWorth(accounts, s.values),
    ] as (string | number | Date | null)[];
  });
  // tutte le colonne tranne "Mese" sono importi in €
  const eurColumns = headers.map((_, i) => i).filter((i) => i > 0);
  return { name: 'Patrimonio', headers, rows, eurColumns, dateColumns: [0] };
}

/**
 * Foglio "Portafoglio": posizioni correnti valorizzate. Prezzo con la stessa catena dell'app
 * (`lastPrice` già in EUR → `manualPrice` → costo medio). Riga finale di totale.
 */
export function portfolioSheet(
  holdings: readonly Holding[],
  instruments: readonly Instrument[],
): SheetData {
  const byId = new Map(instruments.map((i) => [i.id ?? i.symbol, i]));
  const positions = holdings
    .map((h) => {
      const ins = byId.get(h.instrumentId);
      const price = ins?.lastPrice ?? ins?.manualPrice ?? h.avgCost;
      const value = h.quantity * price;
      const cost = h.quantity * h.avgCost;
      const pl = value - cost;
      return {
        symbol: ins?.symbol ?? h.instrumentId,
        name: ins?.name ?? '',
        qty: h.quantity,
        avgCost: h.avgCost,
        price,
        value,
        pl,
        plPct: cost > 0 ? pl / cost : null,
      };
    })
    .sort((a, b) => b.value - a.value);

  const total = positions.reduce((s, p) => s + p.value, 0);
  const headers = [
    'Titolo',
    'Nome',
    'Quantità',
    'PMC (€)',
    'Prezzo (€)',
    'Valore (€)',
    'P&L (€)',
    'P&L %',
    'Peso %',
  ];
  const rows: (string | number | Date | null)[][] = positions.map((p) => [
    p.symbol,
    p.name,
    p.qty,
    p.avgCost,
    p.price,
    p.value,
    p.pl,
    p.plPct,
    total > 0 ? p.value / total : null,
  ]);
  if (positions.length) {
    rows.push([
      'Totale',
      '',
      null,
      null,
      null,
      total,
      positions.reduce((s, p) => s + p.pl, 0),
      null,
      total > 0 ? 1 : null,
    ]);
  }
  return { name: 'Portafoglio', headers, rows, eurColumns: [3, 4, 5, 6], pctColumns: [7, 8] };
}
