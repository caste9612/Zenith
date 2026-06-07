// Shaping PURO dei dati dell'app → righe di un foglio Excel. Niente ExcelJS qui (così è testabile):
// l'ExportService rende questi SheetData in un workbook. Vedi docs/08-testing.md.

import type {
  Account,
  CashFlowMonth,
  Holding,
  Instrument,
  Owner,
  PortfolioHistoryPoint,
  RealizedTrade,
  Snapshot,
  Transaction,
} from '../models';
import { ASSET_CLASS_LABELS, OWNER_LABELS } from '../models';
import { computeNetWorth, totalsByAssetClass, totalsByOwner } from '../balance/net-worth';
import { seriesMetrics } from '../portfolio/metrics';
import { formatEur, formatPercent, formatPercentPlain, formatSignedEur } from '../money/format';

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
const monthLabel = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });
const TX_LABEL: Record<string, string> = {
  buy: 'Acquisto',
  sell: 'Vendita',
  dividend: 'Dividendo',
  deposit: 'Deposito',
  withdraw: 'Prelievo',
  valuation: 'Valorizzazione',
};

/**
 * Foglio "Patrimonio" (≈ foglio Amorini dell'Excel): un mese per riga, una colonna per voce
 * (ordinate per intestatario), più i subtotali per intestatario e il **Totale netto**. I nomi
 * duplicati (es. due "Riserva") vengono disambiguati con l'intestatario.
 */
export function patrimonioSheet(
  accounts: readonly Account[],
  snapshots: readonly Snapshot[],
): SheetData {
  const cols = [...accounts].sort(
    (a, b) => ownerRank[a.owner] - ownerRank[b.owner] || (a.order ?? 0) - (b.order ?? 0),
  );
  const nameCount = new Map<string, number>();
  for (const a of cols) nameCount.set(a.name, (nameCount.get(a.name) ?? 0) + 1);
  const colHeader = (a: Account) =>
    (nameCount.get(a.name) ?? 0) > 1 ? `${a.name} (${OWNER_LABELS[a.owner]})` : a.name;

  const headers = [
    'Mese',
    ...cols.map(colHeader),
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

/** Foglio "Riepilogo": valori chiave del patrimonio (valori già formattati, sola lettura). */
export function riepilogoSheet(
  accounts: readonly Account[],
  snapshots: readonly Snapshot[],
): SheetData {
  const headers = ['Voce', 'Valore'];
  const rows: (string | number | Date | null)[][] = [];
  const latest = snapshots.at(-1);
  if (latest) {
    const m = seriesMetrics(snapshots.map((s) => s.netWorth));
    const prev = snapshots.at(-2);
    const yearAgo = snapshots.length >= 13 ? snapshots[snapshots.length - 13] : null;
    rows.push(['Patrimonio netto', formatEur(latest.netWorth)]);
    if (prev) rows.push(['Variazione 1 mese', formatSignedEur(latest.netWorth - prev.netWorth)]);
    if (yearAgo)
      rows.push(['Variazione 12 mesi', formatSignedEur(latest.netWorth - yearAgo.netWorth)]);
    if (m.steps >= 2) {
      rows.push(['Crescita annua (CAGR)', formatPercent(m.cagr)]);
      rows.push(['Volatilità', formatPercentPlain(m.volatility)]);
      rows.push(['Max drawdown', '−' + formatPercentPlain(m.maxDrawdown)]);
    }
    rows.push(['', '']);
    rows.push(['— Per intestatario —', '']);
    const owner = totalsByOwner(accounts, latest.values);
    for (const o of ['antonio', 'michela', 'shared'] as Owner[]) {
      if (owner.has(o)) rows.push([OWNER_LABELS[o], formatEur(owner.get(o) ?? 0)]);
    }
    rows.push(['', '']);
    rows.push(['— Per classe —', '']);
    [...totalsByAssetClass(accounts, latest.values, { assetsOnly: true }).entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([c, v]) => rows.push([ASSET_CLASS_LABELS[c], formatEur(v)]));
    rows.push(['', '']);
    rows.push(['Aggiornato al', monthLabel.format(latest.date)]);
  }
  return { name: 'Riepilogo', headers, rows };
}

/** Foglio "Movimenti": transazioni (acquisti/vendite/dividendi), dalla più recente. */
export function movimentiSheet(
  transactions: readonly Transaction[],
  instruments: readonly Instrument[],
): SheetData {
  const byId = new Map(instruments.map((i) => [i.id ?? i.symbol, i]));
  const headers = ['Data', 'Tipo', 'Titolo', 'Quantità', 'Prezzo (€)', 'Importo (€)'];
  const rows = [...transactions]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map(
      (t) =>
        [
          t.date,
          TX_LABEL[t.type] ?? t.type,
          t.instrumentId ? (byId.get(t.instrumentId)?.symbol ?? t.instrumentId) : '',
          t.quantity ?? null,
          t.price ?? null,
          t.amount,
        ] as (string | number | Date | null)[],
    );
  return { name: 'Movimenti', headers, rows, eurColumns: [4, 5], dateColumns: [0] };
}

/** Foglio "Operazioni chiuse": vendite e dividendi storici con P/L realizzato. */
export function realizedSheet(trades: readonly RealizedTrade[]): SheetData {
  const headers = ['Data', 'Titolo', 'Tipo', 'Quantità', 'Costo (€)', 'Ricavo (€)', 'P&L (€)', 'P&L %'];
  const rows = trades.map(
    (t) =>
      [
        t.date,
        t.symbol,
        t.kind === 'dividend' ? 'Dividendo' : 'Vendita',
        t.quantity ?? null,
        t.cost ?? null,
        t.proceeds,
        t.pl,
        t.plPct ?? null,
      ] as (string | number | Date | null)[],
  );
  return { name: 'Operazioni chiuse', headers, rows, eurColumns: [4, 5, 6], pctColumns: [7], dateColumns: [0] };
}

/** Foglio "Track record": storico mensile del portafoglio + benchmark. */
export function trackRecordSheet(history: readonly PortfolioHistoryPoint[]): SheetData {
  const headers = [
    'Mese',
    'Valore (€)',
    'Investito (€)',
    'Realizzato cum. (€)',
    'P/L aperto (€)',
    'Dividendi (€)',
    'S&P 500 (€)',
    'NASDAQ (€)',
  ];
  const rows = history.map(
    (p) =>
      [p.date, p.value, p.invested, p.realized, p.openPL, p.dividends, p.sp, p.nasdaq] as (
        | string
        | number
        | Date
        | null
      )[],
  );
  return { name: 'Track record', headers, rows, eurColumns: [1, 2, 3, 4, 5, 6, 7], dateColumns: [0] };
}

/** Foglio "Cash flow": flusso mensile + tasso di risparmio e tassazione (derivati). */
export function cashflowSheet(months: readonly CashFlowMonth[]): SheetData {
  const headers = [
    'Mese',
    'Lordo (€)',
    'Netto (€)',
    'Uscite (€)',
    'Tasse (€)',
    'Risparmio (€)',
    'Tasso risparmio',
    'Netto/Lordo',
  ];
  const rows = months.map(
    (m) =>
      [
        m.date,
        m.gross,
        m.income,
        m.expenses,
        m.tax,
        m.saved,
        m.income && m.income > 0 && m.saved != null ? m.saved / m.income : null,
        m.gross && m.gross > 0 && m.income != null ? m.income / m.gross : null,
      ] as (string | number | Date | null)[],
  );
  return { name: 'Cash flow', headers, rows, eurColumns: [1, 2, 3, 4, 5], pctColumns: [6, 7], dateColumns: [0] };
}
