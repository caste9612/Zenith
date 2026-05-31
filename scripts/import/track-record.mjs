// Importa il TRACK RECORD mensile + benchmark dal foglio "Azionario" dell'Excel nella
// collezione users/{uid}/portfolioHistory (un doc per mese, id YYYY-MM → idempotente).
// Per ogni mese: valore portafoglio, investito, realizzato cumulato, P/L aperto, dividendi,
// e il valore simulato di S&P 500 e NASDAQ con lo stesso flusso investito.
// Esegui: npm run import:trackrecord    (richiede .env con FIREBASE_* + SEED_*)

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
const env = parseEnv(readFileSync(resolve(root, '.env'), 'utf8'));
const xlPath = ['Balance Sheet.xlsx', 'data/Balance Sheet.xlsx']
  .map((c) => resolve(root, c))
  .find((p) => existsSync(p));
if (!xlPath) {
  console.error('❌ Excel non trovato.');
  process.exit(1);
}

const wb = XLSX.readFile(xlPath, { cellDates: true });
const grid = XLSX.utils.sheet_to_json(wb.Sheets['Azionario'], {
  header: 1,
  raw: true,
  defval: null,
  blankrows: true,
});
const A = (r) => (typeof grid[r]?.[0] === 'string' ? grid[r][0].trim() : '');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

// Mappa righe (0-based) dedotta dall'audit del foglio. Asserzioni difensive: se l'Excel
// cambia struttura, lo script si ferma invece di importare dati sbagliati.
const ROWS = {
  mese: 84,
  dividendi: 86,
  realizzato: 87, // CH. CUM (realizzato cumulato)
  aperto: 88, // APERTE (P/L non realizzato del mese)
  totale: 89, // TOTALE (= realizzato + aperto)
  valore: 91, // VALORE portafoglio
  investito: 92, // INVESTITO
  spValore: 98, // S&P EUR → VALORE
  nqValore: 107, // NQ EUR → VALORE
};
const EXPECT = {
  84: 'MESE',
  86: 'DIVIDENDI',
  87: 'CH. CUM',
  88: 'APERTE',
  89: 'TOTALE',
  91: 'VALORE',
  92: 'INVESTITO',
  98: 'VALORE',
  107: 'VALORE',
};
for (const [r, label] of Object.entries(EXPECT)) {
  if (A(r) !== label) {
    console.error(`❌ Struttura Azionario inattesa: riga ${r} = "${A(r)}", attesa "${label}".`);
    process.exit(1);
  }
}

const monthEndUTC = (d) => {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, last, 12, 0, 0));
};
const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

const mese = grid[ROWS.mese];
const points = [];
for (let c = 1; c < mese.length; c++) {
  const d = mese[c];
  if (!(d instanceof Date)) continue;
  const value = num(grid[ROWS.valore]?.[c]);
  if (value === null) continue; // mesi senza valore portafoglio → fuori serie
  points.push({
    key: monthKey(d),
    date: monthEndUTC(d),
    value,
    invested: num(grid[ROWS.investito]?.[c]),
    realized: num(grid[ROWS.realizzato]?.[c]),
    openPL: num(grid[ROWS.aperto]?.[c]),
    total: num(grid[ROWS.totale]?.[c]),
    dividends: num(grid[ROWS.dividendi]?.[c]),
    sp: num(grid[ROWS.spValore]?.[c]),
    nasdaq: num(grid[ROWS.nqValore]?.[c]),
  });
}

const last = points.at(-1);
console.log(`Mesi: ${points.length} (${points[0]?.key} → ${last?.key})`);
console.log(
  `Ultimo (${last?.key}): valore=${last?.value} investito=${last?.invested} realizzato=${last?.realized} S&P=${last?.sp} NASDAQ=${last?.nasdaq}`,
);

// --- scrivi su Firestore -----------------------------------------------------
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
const col = collection(db, 'users', cred.user.uid, 'portfolioHistory');

const batch = writeBatch(db);
for (const p of points) {
  batch.set(doc(col, p.key), {
    id: p.key,
    date: Timestamp.fromDate(p.date),
    value: p.value,
    invested: p.invested,
    realized: p.realized,
    openPL: p.openPL,
    total: p.total,
    dividends: p.dividends,
    sp: p.sp,
    nasdaq: p.nasdaq,
  });
}
await batch.commit();
console.log(`✓ Scritti ${points.length} punti in portfolioHistory (id YYYY-MM).`);
process.exit(0);
