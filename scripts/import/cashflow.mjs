// Importa il FLUSSO DI CASSA mensile dal foglio "CashFlow" dell'Excel nella collezione read-only
// users/{uid}/cashFlow (un doc per mese, id YYYY-MM → idempotente).
//
// Esegui: npm run import:cashflow
//   - SENZA SEED_EMAIL/SEED_PASSWORD in .env → DRY RUN: parsa, valida e stampa, senza scrivere.
//   - CON le credenziali → scrive su Firestore.
// Legge l'Excel locale (gitignored). Dati di NUCLEO (non divisi per intestatario).

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
const grid = XLSX.utils.sheet_to_json(wb.Sheets['CashFlow'], {
  header: 1,
  raw: true,
  defval: null,
  blankrows: true,
});

// Righe (0-based) dedotte dall'audit del foglio. Asserzioni difensive sulle etichette in col A.
const ROWS = { mese: 43, gross: 44, income: 46, expenses: 48, tax: 50, saved: 52 };
const A = (r) => (typeof grid[r]?.[0] === 'string' ? grid[r][0].trim() : '');
const EXPECT = { 43: 'MESE', 44: 'LORDO', 46: 'IN', 48: 'OUT', 50: 'Tax', 52: 'CashFlow' };
for (const [r, label] of Object.entries(EXPECT)) {
  if (A(r) !== label) {
    console.error(
      `❌ Struttura CashFlow inattesa: riga ${Number(r) + 1} = "${A(r)}", attesa "${label}".`,
    );
    process.exit(1);
  }
}

const mese = grid[ROWS.mese];
const months = [];
const warnings = [];
for (let c = 1; c < mese.length; c++) {
  const d = mese[c];
  if (!(d instanceof Date)) continue;
  const income = num(grid[ROWS.income]?.[c]);
  const expenses = num(grid[ROWS.expenses]?.[c]);
  const saved = num(grid[ROWS.saved]?.[c]);
  const gross = num(grid[ROWS.gross]?.[c]);
  const tax = num(grid[ROWS.tax]?.[c]);
  if (income === null && expenses === null && saved === null) continue; // mese vuoto
  // sanity: saved ≈ income − expenses
  if (
    income !== null &&
    expenses !== null &&
    saved !== null &&
    Math.abs(saved - (income - expenses)) > 1
  ) {
    warnings.push(
      `${monthKey(d)}: saved ${saved} ≠ income−expenses ${Math.round((income - expenses) * 100) / 100}`,
    );
  }
  months.push({ key: monthKey(d), date: monthEndUTC(d), gross, income, expenses, tax, saved });
}

// --- riepilogo ---------------------------------------------------------------
const sum = (k) => Math.round(months.reduce((s, m) => s + (m[k] ?? 0), 0));
console.log(`✓ Excel: ${xlPath}`);
console.log(`Mesi: ${months.length}  (${months[0]?.key} → ${months.at(-1)?.key})`);
console.log(
  `Totali: lordo €${sum('gross').toLocaleString('it-IT')} · netto €${sum('income').toLocaleString('it-IT')} · uscite €${sum('expenses').toLocaleString('it-IT')} · risparmio €${sum('saved').toLocaleString('it-IT')}`,
);
const totIncome = sum('income');
if (totIncome > 0)
  console.log(`Tasso di risparmio medio: ${((sum('saved') / totIncome) * 100).toFixed(1)}%`);
if (warnings.length) {
  console.log(`⚠ ${warnings.length} mesi con saved ≠ income−expenses:`);
  for (const w of warnings.slice(0, 8)) console.log(`   ${w}`);
} else {
  console.log('✓ Sanity: saved == income − expenses in ogni mese.');
}

// --- scrittura Firestore (solo con credenziali) ------------------------------
if (!env.SEED_EMAIL || !env.SEED_PASSWORD || !env.FIREBASE_API_KEY) {
  console.log(
    '\nℹ️  DRY RUN: SEED_EMAIL/SEED_PASSWORD assenti in .env → nessuna scrittura su Firestore.',
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
const col = collection(db, 'users', cred.user.uid, 'cashFlow');

const batch = writeBatch(db);
for (const m of months) {
  batch.set(doc(col, m.key), {
    id: m.key,
    date: Timestamp.fromDate(m.date),
    gross: m.gross,
    income: m.income,
    expenses: m.expenses,
    tax: m.tax,
    saved: m.saved,
  });
}
await batch.commit();
console.log(`✓ Scritti ${months.length} mesi in cashFlow (id YYYY-MM).`);
process.exit(0);
