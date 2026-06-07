// Parser dell'Excel storico → seed strutturato (data/seed.json) secondo lo schema dell'app.
// Strumento di SVILUPPO locale: legge l'Excel fidato dell'utente, non entra nel bundle.
// In questa fase estrae il CORE decisionale:
//   - accounts + snapshots dal foglio "Amorini" (bilancio familiare mensile)
//   - instruments + holdings dalla tabella ASSET ALLOCATION del foglio "Azionario"
// (track-record mensile e fondo crypto verranno strutturati nel passo successivo).

import * as XLSXns from 'xlsx';
// SheetJS è CommonJS: con l'import ESM le funzioni possono finire sotto `.default`.
const XLSX = XLSXns.readFile ? XLSXns : (XLSXns.default ?? XLSXns);
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

// --- helpers ---------------------------------------------------------------
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/\s/g, '').replace(/ /g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
};
const isDate = (v) => v instanceof Date && !Number.isNaN(v.getTime());
const round2 = (n) => Math.round(n * 100) / 100;
// SheetJS produce date come istanti UTC (la mezzanotte locale di fine mese può rotolare al
// giorno dopo in locale): si usano SEMPRE i componenti UTC, che combaciano con la cella Excel.
const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const isoDate = (d) => `${monthKey(d)}-${String(d.getUTCDate()).padStart(2, '0')}`;

// --- individua l'Excel ------------------------------------------------------
const candidates = ['Balance Sheet.xlsx', 'data/patrimonio.xlsx', 'data/Balance Sheet.xlsx'];
const xlPath = candidates.map((c) => resolve(root, c)).find((p) => existsSync(p));
if (!xlPath) {
  console.error('❌ Excel non trovato. Cercato:', candidates.join(', '));
  process.exit(1);
}
const wb = XLSX.readFile(xlPath, { cellDates: true });
const grid = (name) =>
  XLSX.utils.sheet_to_json(wb.Sheets[name], {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  });

// --- Amorini → accounts + snapshots ----------------------------------------
// Colonne (0-based) dedotte dall'intestazione del foglio Amorini.
const ACCOUNTS = [
  {
    id: 'azionario',
    name: 'Azionario',
    owner: 'antonio',
    assetClass: 'equity',
    col: 1,
    linkedToPortfolio: true,
  },
  { id: 'crypto', name: 'Crypto', owner: 'antonio', assetClass: 'crypto', col: 2 },
  {
    id: 'pensione-antonio',
    name: 'F. Pensione Antonio',
    owner: 'antonio',
    assetClass: 'pension',
    col: 4,
  },
  { id: 'cash-antonio', name: 'Cash', owner: 'antonio', assetClass: 'cash', col: 6 },
  { id: 'riserva-antonio', name: 'Riserva', owner: 'antonio', assetClass: 'reserve', col: 8 },
  {
    id: 'risparmi-michela',
    name: 'Risparmi Michela',
    owner: 'michela',
    assetClass: 'cash',
    col: 9,
  },
  {
    id: 'pensione-michela',
    name: 'F. Pensione Michela',
    owner: 'michela',
    assetClass: 'pension',
    col: 11,
  },
  {
    id: 'emergenza-michela',
    name: 'F. Emergenza Poste',
    owner: 'michela',
    assetClass: 'emergency',
    col: 13,
  },
  { id: 'riserva-michela', name: 'Riserva', owner: 'michela', assetClass: 'reserve', col: 15 },
  { id: 'cassa-famiglia', name: 'Cassa Famiglia', owner: 'shared', assetClass: 'cash', col: 16 },
];
const COL_TOTAL = 18; // S
const COL_OWNER = { antonio: 19, michela: 20, shared: 21 }; // T, U, V
const COL_SAVING = 22; // W

const accounts = ACCOUNTS.map(({ col, ...a }, i) => ({
  ...a,
  currency: 'EUR',
  isLiability: a.assetClass === 'liability',
  order: i,
  active: true,
}));

const amorini = grid('Amorini');
const snapshots = [];
const validations = [];
for (let r = 0; r < amorini.length; r++) {
  const row = amorini[r] || [];
  const d = row[0];
  if (!isDate(d)) continue;
  const values = {};
  let sum = 0;
  let hasAny = false;
  for (const a of ACCOUNTS) {
    const v = num(row[a.col]);
    if (v !== null) {
      values[a.id] = v;
      sum += a.assetClass === 'liability' ? -v : v;
      hasAny = true;
    }
  }
  if (!hasAny) continue; // mesi futuri vuoti
  const byOwner = {};
  for (const [owner, c] of Object.entries(COL_OWNER)) {
    const v = num(row[c]);
    if (v !== null) byOwner[owner] = v;
  }
  const excelTotal = num(row[COL_TOTAL]);
  const savingRate = num(row[COL_SAVING]);
  const netWorth = round2(sum);
  if (excelTotal !== null && Math.abs(excelTotal - netWorth) > 1) {
    validations.push({
      month: monthKey(d),
      computed: netWorth,
      excel: excelTotal,
      diff: round2(excelTotal - netWorth),
    });
  }
  snapshots.push({
    id: monthKey(d),
    date: isoDate(d),
    values,
    netWorth,
    netWorthExcel: excelTotal,
    byOwner: Object.keys(byOwner).length ? byOwner : undefined,
    savingRate: savingRate ?? undefined,
  });
}

// --- Azionario → instruments + holdings (tabella ASSET ALLOCATION) ----------
const azion = grid('Azionario');
// last.update in I3 (es. "last.update. 18/05/2025")
let lastUpdate = null;
const i3 = azion[2]?.[8];
if (typeof i3 === 'string') {
  const m = i3.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) lastUpdate = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
const instruments = [];
const holdings = [];
const seenSymbols = new Set();
// header a riga 5 (index 4): A=SIMBOLO,B=QUANTITA,C=PMC,D=PREZZO,E=VALORE,F=P/L%,G=P/L
for (let r = 5; r < 40; r++) {
  const row = azion[r] || [];
  const sym = typeof row[0] === 'string' ? row[0].trim() : null;
  if (sym && sym.toUpperCase() === 'TOTALE') break;
  if (!sym) continue;
  const quantity = num(row[1]);
  const avgCost = num(row[2]);
  const price = num(row[3]);
  if (quantity === null) continue; // righe non-posizione
  if (!seenSymbols.has(sym)) {
    seenSymbols.add(sym);
    instruments.push({
      symbol: sym,
      name: sym,
      assetType: 'equity',
      currency: 'EUR',
      provider: 'finnhub',
      lastPrice: price ?? undefined,
      lastPriceAt: price !== null ? (lastUpdate ?? undefined) : undefined,
    });
  }
  holdings.push({
    accountId: 'azionario',
    instrumentSymbol: sym,
    quantity,
    avgCost: avgCost ?? 0,
    currency: 'EUR',
    priceMode: 'auto',
  });
}

// --- output ----------------------------------------------------------------
const latest = snapshots[snapshots.length - 1];
const seed = {
  meta: {
    source: 'Balance Sheet.xlsx',
    generatedFrom: ['Amorini', 'Azionario'],
    note: 'Seed CORE (familiare). Track-record mensile e fondo crypto da strutturare nel passo successivo.',
    accounts: accounts.length,
    snapshots: snapshots.length,
    holdings: holdings.length,
    instruments: instruments.length,
  },
  accounts,
  snapshots,
  instruments,
  holdings,
};

const outPath = resolve(root, 'data/seed.json');
writeFileSync(outPath, JSON.stringify(seed, null, 2), 'utf8');

// --- report ----------------------------------------------------------------
console.log(`✓ Excel: ${xlPath}`);
console.log(`✓ Scritto: ${outPath}`);
console.log('');
console.log(`Accounts:   ${accounts.length}`);
console.log(`Snapshots:  ${snapshots.length}  (${snapshots[0]?.id} → ${latest?.id})`);
console.log(`Holdings:   ${holdings.length}   Instruments: ${instruments.length}`);
console.log(`Azionario last.update: ${lastUpdate ?? 'n/d'}`);
console.log('');
console.log(
  `Ultimo mese (${latest?.id}): patrimonio netto = € ${latest?.netWorth?.toLocaleString('it-IT')}`,
);
console.log('  per voce:');
for (const a of accounts) {
  const v = latest?.values?.[a.id];
  if (v !== undefined)
    console.log(`   - ${a.name.padEnd(22)} ${String(v).padStart(8)}  [${a.owner}/${a.assetClass}]`);
}
console.log('');
console.log('Holdings correnti (Azionario):');
for (const h of holdings) {
  console.log(
    `   - ${h.instrumentSymbol.padEnd(10)} qty ${String(h.quantity).padStart(7)}  PMC € ${h.avgCost}`,
  );
}
console.log('');
if (validations.length) {
  console.log(
    `⚠ Validazione netWorth vs colonna "Total" Excel: ${validations.length} mesi con scostamento >1€`,
  );
  for (const v of validations.slice(0, 6))
    console.log(`   ${v.month}: calcolato ${v.computed} vs Excel ${v.excel} (Δ ${v.diff})`);
  if (validations.length > 6) console.log(`   …e altri ${validations.length - 6}`);
} else {
  console.log(
    '✓ Validazione: la somma delle voci coincide con la colonna "Total" dell\'Excel in tutti i mesi.',
  );
}
