import type {
  Account,
  AssetClass,
  CashFlowMonth,
  Holding,
  Instrument,
  Owner,
  RealizedTrade,
  Snapshot,
} from '../models';
import { cashflowSheet, patrimonioSheet, portfolioSheet, realizedSheet } from './sheets';

function acc(
  id: string,
  name: string,
  owner: Owner,
  assetClass: AssetClass,
  order: number,
  isLiability = false,
): Account {
  return { id, name, owner, assetClass, isLiability, currency: 'EUR', order, active: true };
}

describe('export/sheets · patrimonioSheet', () => {
  const accounts: Account[] = [
    acc('a', 'A', 'antonio', 'equity', 0),
    acc('c', 'C', 'antonio', 'cash', 1),
    acc('m', 'M', 'michela', 'cash', 2),
    acc('s', 'S', 'shared', 'cash', 3),
    acc('mutuo', 'Mutuo', 'shared', 'liability', 4, true),
  ];
  const date = new Date(2025, 0, 31);
  const snapshots: Snapshot[] = [
    { id: '2025-01', date, netWorth: 3000, values: { a: 1000, c: 500, m: 2000, s: 300, mutuo: 800 } },
  ];

  it('intestazioni: Mese + voci (ordinate per intestatario) + subtotali + netto', () => {
    const sheet = patrimonioSheet(accounts, snapshots);
    expect(sheet.headers).toEqual([
      'Mese',
      'A',
      'C',
      'M',
      'S',
      'Mutuo',
      'Tot. Antonio',
      'Tot. Michela',
      'Tot. Condiviso',
      'Totale netto',
    ]);
    expect(sheet.dateColumns).toEqual([0]);
    expect(sheet.eurColumns).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]); // tutto tranne Mese
  });

  it('riga: valori per voce + subtotali con segno (passività sottrae) + netto', () => {
    const { rows } = patrimonioSheet(accounts, snapshots);
    // A,C (Antonio) 1500 · M (Michela) 2000 · S−Mutuo (Condiviso) −500 · netto 3000
    expect(rows[0]).toEqual([date, 1000, 500, 2000, 300, 800, 1500, 2000, -500, 3000]);
  });

  it('voce senza valore nel mese → cella vuota (null)', () => {
    const snaps: Snapshot[] = [{ id: '2025-02', date, netWorth: 1000, values: { a: 1000 } }];
    const { rows } = patrimonioSheet(accounts, snaps);
    expect(rows[0][2]).toBeNull(); // colonna C, assente
  });
});

describe('export/sheets · portfolioSheet', () => {
  const instruments: Instrument[] = [
    { id: 'AAA', symbol: 'AAA', name: 'Alpha', assetType: 'equity', currency: 'EUR', provider: 'finnhub', lastPrice: 12 },
    { id: 'BBB', symbol: 'BBB', name: 'Beta', assetType: 'equity', currency: 'EUR', provider: 'finnhub', manualPrice: 50 },
  ];
  const holdings: Holding[] = [
    { instrumentId: 'AAA', accountId: 'azionario', quantity: 10, avgCost: 10, currency: 'EUR', priceMode: 'auto' },
    { instrumentId: 'BBB', accountId: 'azionario', quantity: 2, avgCost: 60, currency: 'EUR', priceMode: 'manual' },
  ];

  it('valorizza con lastPrice→manuale, P&L e peso; ordina per valore; riga Totale', () => {
    const { headers, rows, eurColumns, pctColumns } = portfolioSheet(holdings, instruments);
    expect(headers[0]).toBe('Titolo');
    expect(eurColumns).toEqual([3, 4, 5, 6]);
    expect(pctColumns).toEqual([7, 8]);

    // AAA: 10×12=120 (lastPrice), P&L 20, +20%; pesa 120/220
    expect(rows[0][0]).toBe('AAA');
    expect(rows[0][5]).toBe(120);
    expect(rows[0][6]).toBe(20);
    expect(rows[0][7] as number).toBeCloseTo(0.2, 10);
    expect(rows[0][8] as number).toBeCloseTo(120 / 220, 10);

    // BBB: 2×50=100 (manualPrice), P&L −20
    expect(rows[1][0]).toBe('BBB');
    expect(rows[1][5]).toBe(100);
    expect(rows[1][6]).toBe(-20);

    // riga Totale: valore 220, P&L 0 (20−20), peso 100%
    const totale = rows[2];
    expect(totale[0]).toBe('Totale');
    expect(totale[5]).toBe(220);
    expect(totale[6]).toBe(0);
    expect(totale[8]).toBe(1);
  });

  it('nessuna posizione → solo intestazioni, niente riga Totale', () => {
    const { rows } = portfolioSheet([], instruments);
    expect(rows.length).toBe(0);
  });
});

describe('export/sheets · altri fogli', () => {
  it('patrimonioSheet: nomi duplicati disambiguati con intestatario', () => {
    const accounts: Account[] = [
      acc('ra', 'Riserva', 'antonio', 'reserve', 0),
      acc('rm', 'Riserva', 'michela', 'reserve', 1),
      acc('c', 'Cash', 'antonio', 'cash', 2),
    ];
    const { headers } = patrimonioSheet(accounts, []);
    expect(headers).toContain('Riserva (Antonio)');
    expect(headers).toContain('Riserva (Michela)');
    expect(headers).toContain('Cash'); // unico → senza intestatario
  });

  it('cashflowSheet: tasso di risparmio e netto/lordo derivati', () => {
    const months: CashFlowMonth[] = [
      { id: '2025-01', date: new Date(2025, 0, 31), gross: 2000, income: 1500, expenses: 900, tax: 500, saved: 600 },
      { id: '2025-02', date: new Date(2025, 1, 28), gross: null, income: null, expenses: null, tax: null, saved: null },
    ];
    const { rows, pctColumns } = cashflowSheet(months);
    expect(pctColumns).toEqual([6, 7]);
    expect(rows[0][6] as number).toBeCloseTo(600 / 1500, 10); // tasso di risparmio
    expect(rows[0][7] as number).toBeCloseTo(1500 / 2000, 10); // netto/lordo
    expect(rows[1][6]).toBeNull(); // dati mancanti → null
    expect(rows[1][7]).toBeNull();
  });

  it('realizedSheet: vendite e dividendi, etichette e colonne', () => {
    const trades: RealizedTrade[] = [
      { id: '2024-07-1', date: new Date(2024, 6, 31), symbol: 'AAA', kind: 'sale', cost: 100, quantity: 5, proceeds: 130, pl: 30, plPct: 0.3 },
      { id: '2024-08-1', date: new Date(2024, 7, 31), symbol: 'BBB', kind: 'dividend', cost: null, quantity: null, proceeds: 12, pl: 12, plPct: null },
    ];
    const { rows, eurColumns, pctColumns } = realizedSheet(trades);
    expect(eurColumns).toEqual([4, 5, 6]);
    expect(pctColumns).toEqual([7]);
    expect(rows[0][2]).toBe('Vendita');
    expect(rows[0][7] as number).toBeCloseTo(0.3, 10);
    expect(rows[1][2]).toBe('Dividendo');
    expect(rows[1][3]).toBeNull(); // dividendo: niente quantità
    expect(rows[1][7]).toBeNull(); // dividendo: niente %
  });
});
