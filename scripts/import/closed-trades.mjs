// Importa le OPERAZIONI CHIUSE (vendite + dividendi) dai blocchi "CLOSED POSITION" del foglio
// "Azionario" → collezione read-only users/{uid}/realizedTrades (un doc per operazione, id
// `YYYY-MM-n` → idempotente). Aggiunge il DETTAGLIO dietro al realizzato aggregato di portfolioHistory.
//
// Esegui: npm run import:trades
//   - SENZA SEED_EMAIL/SEED_PASSWORD in .env → DRY RUN: parsa, valida e stampa, senza scrivere.
//   - CON le credenziali → scrive su Firestore.
// Legge l'Excel locale (gitignored). I dividendi sono marcati kind:'dividend' (lo storico li
// elenca insieme alle vendite, com'è nell'Excel).

import * as XLSXns from 'xlsx';
const XLSX = XLSXns.readFile ? XLSXns : (XLSXns.default ?? XLSXns);
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getFirestore, Timestamp, writeBatch } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}
const env = existsSync(resolve(root, '.env'))
  ? parseEnv(readFileSync(resolve(root, '.env'), 'utf8'))
  : {};

const xlPath = ['Balance Sheet.xlsx', 'data/Balance Sheet.xlsx']
  .map((c) => resolve(root, c))
  .find((p) => existsSync(p));
if (!xlPath) {
  console.error('❌ Excel non trovato.');
  process.exit(1);
}

// --- parsing -----------------------------------------------------------------
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isNaN(n) ? null : n;
};
const monthEndUTC = (d) => {
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), last, 12, 0, 0));
};
const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

const wb = XLSX.readFile(xlPath, { cellDates: true });
const grid = XLSX.utils.sheet_to_json(wb.Sheets['Azionario'], {
  header: 1,
  raw: true,
  defval: null,
  blankrows: true,
});

// Righe (0-based) dedotte dall'audit del foglio. Asserzioni difensive: se l'Excel cambia struttura,
// lo script si ferma invece di importare dati sbagliati.
const ROW_MONTH = 36; // riga 37: date dei blocchi (stride 7 colonne)
const ROW_CLOSED = 68; // riga 69: "CLOSED POSITION"
const ROW_HEAD = 70; // riga 71: SIMBOLO/COSTO/QUANTITA/—/UTILE/P-L%/P-L
const ROW_FIRST = 71; // prima riga operazioni
const ROW_TOTAL = 80; // riga 81: TOTALE del blocco
const BLOCK = 7; // larghezza blocco mese
const A = (r, c) => (typeof grid[r]?.[c] === 'string' ? grid[r][c].trim() : '');
if (A(ROW_CLOSED, 0) !== 'CLOSED POSITION' || A(ROW_HEAD, 0) !== 'SIMBOLO') {
  console.error(
    `❌ Struttura Azionario inattesa: riga ${ROW_CLOSED + 1}="${A(ROW_CLOSED, 0)}", riga ${ROW_HEAD + 1}="${A(ROW_HEAD, 0)}".`,
  );
  process.exit(1);
}

const isDiv = (sym) => /[-:]\s*div/i.test(sym);
const cleanSymbol = (sym) => sym.replace(/\s*[-:]\s*div.*$/i, '').trim() || sym;

const trades = [];
const warnings = [];
for (let c = 0; grid[ROW_MONTH]?.[c] instanceof Date; c += BLOCK) {
  if (A(ROW_CLOSED, c) !== 'CLOSED POSITION') continue; // blocco senza sezione chiusure
  const month = grid[ROW_MONTH][c];
  const key = monthKey(month);
  let n = 0;
  let blockSum = 0;
  for (let r = ROW_FIRST; r < ROW_TOTAL; r++) {
    const sym = A(r, c);
    if (!sym || sym.toUpperCase() === 'TOTALE') continue;
    const cost = num(grid[r][c + 1]);
    const quantity = num(grid[r][c + 2]);
    const proceeds = num(grid[r][c + 4]);
    const plPctRaw = num(grid[r][c + 5]);
    let pl = num(grid[r][c + 6]);
    if (pl === null) pl = proceeds; // dividendo con solo "utile"
    if (pl === null && proceeds === null) continue; // riga vuota
    n++;
    const dividend = isDiv(sym);
    blockSum += pl ?? 0;
    trades.push({
      id: `${key}-${n}`,
      date: monthEndUTC(month),
      symbol: cleanSymbol(sym),
      kind: dividend ? 'dividend' : 'sale',
      cost: dividend ? null : cost,
      quantity: dividend ? null : quantity,
      proceeds,
      pl: pl ?? 0,
      plPct: dividend || plPctRaw === null ? null : Math.round((plPctRaw / 100) * 1e6) / 1e6,
    });
  }
  // sanity: somma del blocco ≈ TOTALE dell'Excel (col P/L del blocco)
  const excelTotal = num(grid[ROW_TOTAL]?.[c + 6]);
  if (excelTotal !== null && Math.abs(excelTotal - Math.round(blockSum * 100) / 100) > 0.5) {
    warnings.push(
      `${key}: somma operazioni ${Math.round(blockSum * 100) / 100} vs TOTALE ${excelTotal}`,
    );
  }
}

// --- riepilogo ---------------------------------------------------------------
const sales = trades.filter((t) => t.kind === 'sale');
const divs = trades.filter((t) => t.kind === 'dividend');
const totalPl = Math.round(trades.reduce((s, t) => s + t.pl, 0) * 100) / 100;
console.log(`✓ Excel: ${xlPath}`);
console.log(
  `Operazioni: ${trades.length} (${sales.length} vendite, ${divs.length} dividendi)  ${trades[0]?.id.slice(0, 7)} → ${trades.at(-1)?.id.slice(0, 7)}`,
);
console.log(`P/L realizzato itemizzato: € ${totalPl.toLocaleString('it-IT')}`);
console.log('Prime operazioni:');
for (const t of trades.slice(0, 6))
  console.log(
    `  ${t.id.padEnd(10)} ${t.symbol.padEnd(8)} ${t.kind.padEnd(8)} P/L € ${t.pl}${t.plPct !== null ? ` (${(t.plPct * 100).toFixed(2)}%)` : ''}`,
  );
if (warnings.length) {
  console.log(`⚠ ${warnings.length} mesi con scostamento somma vs TOTALE Excel:`);
  for (const w of warnings.slice(0, 8)) console.log(`   ${w}`);
} else {
  console.log('✓ Sanity: la somma delle operazioni combacia col TOTALE dell’Excel in ogni mese.');
}
console.log(
  '(Nota: il realizzato "headline" di portfolioHistory include una quota iniziale non dettagliata; questa lista è solo l’itemizzato.)',
);

// --- scrittura Firestore (solo con credenziali) ------------------------------
if (!env.SEED_EMAIL || !env.SEED_PASSWORD || !env.FIREBASE_API_KEY) {
  console.log('');
  console.log(
    'ℹ️  DRY RUN: SEED_EMAIL/SEED_PASSWORD assenti in .env → nessuna scrittura su Firestore.',
  );
  process.exit(0);
}

const app = initializeApp({
  apiKey: env.FIREBASE_API_KEY,
  authDomain: env.FIREBASE_AUTH_DOMAIN,
  projectId: env.FIREBASE_PROJECT_ID,
  storageBucket: env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
  appId: env.FIREBASE_APP_ID,
});
const cred = await signInWithEmailAndPassword(getAuth(app), env.SEED_EMAIL, env.SEED_PASSWORD);
await cred.user.getIdToken(true);
const db = getFirestore(app);
const col = collection(db, 'users', cred.user.uid, 'realizedTrades');

const batch = writeBatch(db);
for (const t of trades) {
  batch.set(doc(col, t.id), {
    id: t.id,
    date: Timestamp.fromDate(t.date),
    symbol: t.symbol,
    kind: t.kind,
    cost: t.cost,
    quantity: t.quantity,
    proceeds: t.proceeds,
    pl: t.pl,
    plPct: t.plPct,
  });
}
await batch.commit();
console.log(`✓ Scritte ${trades.length} operazioni in realizedTrades (id YYYY-MM-n).`);
process.exit(0);
