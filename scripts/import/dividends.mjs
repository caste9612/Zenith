// Importa lo storico DIVIDENDI dal foglio "Azionario" dell'Excel come transazioni 'dividend'
// su Firestore (users/{uid}/transactions). Un movimento per mese (id deterministico
// `div-YYYY-MM` → idempotente: ri-eseguire non duplica). Esegui con: npm run import:dividends
//
// Richiede in .env: FIREBASE_* + SEED_EMAIL/SEED_PASSWORD. Legge l'Excel locale (gitignored).

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

// --- estrai DIVIDENDI per mese dal foglio Azionario --------------------------
const wb = XLSX.readFile(xlPath, { cellDates: true });
const grid = XLSX.utils.sheet_to_json(wb.Sheets['Azionario'], {
  header: 1,
  raw: true,
  defval: null,
  blankrows: true,
});
const rowByLabel = (label) =>
  grid.findIndex((r) => typeof r?.[0] === 'string' && r[0].trim().toUpperCase() === label);
const meseRow = rowByLabel('MESE');
const divRow = rowByLabel('DIVIDENDI');
if (meseRow === -1 || divRow === -1) {
  console.error('❌ Righe MESE/DIVIDENDI non trovate nel foglio Azionario.');
  process.exit(1);
}

const monthEndUTC = (d) => {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, last, 12, 0, 0));
};
const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

const dividends = [];
const mese = grid[meseRow];
const div = grid[divRow];
for (let c = 1; c < mese.length; c++) {
  const d = mese[c];
  const v = div[c];
  if (!(d instanceof Date) || typeof v !== 'number' || !Number.isFinite(v) || v === 0) continue;
  dividends.push({ key: monthKey(d), date: monthEndUTC(d), amount: Math.round(v * 100) / 100 });
}
const total = Math.round(dividends.reduce((s, x) => s + x.amount, 0) * 100) / 100;
console.log(`Trovati ${dividends.length} mesi con dividendi, totale € ${total}`);

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
const col = collection(db, 'users', cred.user.uid, 'transactions');

const batch = writeBatch(db);
for (const d of dividends) {
  const id = `div-${d.key}`;
  batch.set(doc(col, id), {
    id,
    date: Timestamp.fromDate(d.date),
    type: 'dividend',
    accountId: 'azionario',
    amount: d.amount,
    currency: 'EUR',
    notes: 'Dividendi del mese (storico Excel)',
  });
}
await batch.commit();
console.log(`✓ Scritti ${dividends.length} movimenti 'dividend' su Firestore (id div-YYYY-MM).`);
process.exit(0);
