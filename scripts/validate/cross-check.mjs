// Controlli INCROCIATI Excel ↔ app, foglio per foglio. Per ogni foglio rilevante scrive un CSV in
// data/audit/ (gitignorato) con i valori dell'Excel affiancati a quelli dell'app (Firestore) + le
// verifiche INTERNE all'Excel; in fondo stampa l'elenco delle ANOMALIE (sia dell'app sia dell'Excel).
//
//   npm run cross-check
//     - richiede l'Excel in data/ (salta con exit 0 se assente → CI-safe);
//     - con SEED_EMAIL/SEED_PASSWORD + FIREBASE_* in .env confronta anche i dati REALI dell'app;
//       senza, fa solo le verifiche interne all'Excel.
//
// Pensato per la riconciliazione (vedi docs/08 + memoria excel-zenith-reconciliation): l'utente
// aggiorna Excel e app in parallelo e qui controlla che i numeri tornino. CSV con separatore ';'
// e BOM → si aprono puliti in Excel it-IT.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSXns from 'xlsx';
const XLSX = XLSXns.readFile ? XLSXns : (XLSXns.default ?? XLSXns);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

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
  console.log('ℹ️  Excel assente: cross-check saltato (CI-safe).');
  process.exit(0);
}

const wb = XLSX.readFile(xlPath, { cellDates: true });
const grid = (name) =>
  XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true });
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const r2 = (n) => Math.round(n * 100) / 100;
const mk = (d) =>
  d instanceof Date ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}` : null;
const near = (a, b, tol = 1) => a !== null && b !== null && Math.abs(a - b) <= tol;

// --- output CSV (sep ';' + BOM per Excel it-IT) ---
const auditDir = resolve(root, 'data/audit');
mkdirSync(auditDir, { recursive: true });
function writeCsv(file, headers, rows) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'number' ? String(r2(v)).replace('.', ',') : String(v);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const out = [headers.join(';'), ...rows.map((r) => r.map(esc).join(';'))].join('\r\n');
  writeFileSync(resolve(auditDir, file), '﻿' + out, 'utf8');
  console.log(`  → data/audit/${file}  (${rows.length} righe)`);
}

// --- anomalie raccolte ---
const anomalies = [];
const flag = (sheet, key, msg) => anomalies.push({ sheet, key, msg });

// --- dati app da Firestore (opzionale) ---
let app = null;
if (env.SEED_EMAIL && env.SEED_PASSWORD && env.FIREBASE_API_KEY) {
  const { initializeApp } = await import('firebase/app');
  const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
  const { collection, getDocs, getFirestore } = await import('firebase/firestore');
  const fbApp = initializeApp({
    apiKey: env.FIREBASE_API_KEY,
    authDomain: env.FIREBASE_AUTH_DOMAIN,
    projectId: env.FIREBASE_PROJECT_ID,
    storageBucket: env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
    appId: env.FIREBASE_APP_ID,
  });
  const cred = await signInWithEmailAndPassword(getAuth(fbApp), env.SEED_EMAIL, env.SEED_PASSWORD);
  const db = getFirestore(fbApp);
  const load = async (name) =>
    (await getDocs(collection(db, 'users', cred.user.uid, name))).docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  app = {
    snapshots: byId(await load('snapshots')),
    cashFlow: byId(await load('cashFlow')),
    portfolioHistory: byId(await load('portfolioHistory')),
    holdings: await load('holdings'),
    instruments: await load('instruments'),
  };
  console.log(
    `App (Firestore): ${app.snapshots.size} snapshot · ${app.cashFlow.size} cashFlow · ${app.portfolioHistory.size} track record · ${app.holdings.length} holdings\n`,
  );
} else {
  console.log('ℹ️  SEED_* assenti in .env → solo verifiche interne all’Excel (niente confronto app).\n');
}
function byId(rows) {
  return new Map(rows.map((r) => [r.id, r]));
}
const appNum = (rec, field) => (rec && typeof rec[field] === 'number' ? rec[field] : null);

// ===========================================================================
// 1) PATRIMONIO (Amorini ↔ snapshots)
// ===========================================================================
console.log('1) Patrimonio (Amorini ↔ snapshots)');
const ACC = [
  [1, 'antonio'], [2, 'antonio'], [4, 'antonio'], [6, 'antonio'], [8, 'antonio'],
  [9, 'michela'], [11, 'michela'], [13, 'michela'], [15, 'michela'], [16, 'shared'],
];
const PCOL = { total: 18, antonio: 19, michela: 20, shared: 21 };
{
  const rows = [];
  for (const row of grid('Amorini')) {
    const key = mk(row?.[0]);
    if (!key) continue;
    let any = false;
    const byOwner = { antonio: 0, michela: 0, shared: 0 };
    let sum = 0;
    for (const [c, owner] of ACC) {
      const v = num(row[c]);
      if (v !== null) {
        sum += v;
        byOwner[owner] += v;
        any = true;
      }
    }
    if (!any) continue;
    sum = r2(sum);
    const total = num(row[PCOL.total]);
    const ownerCol = r2(
      (num(row[PCOL.antonio]) ?? 0) + (num(row[PCOL.michela]) ?? 0) + (num(row[PCOL.shared]) ?? 0),
    );
    const appNW = appNum(app?.snapshots.get(key), 'netWorth');
    const issues = [];
    if (total !== null && !near(sum, total)) issues.push(`Σvoci≠Total (${sum}/${total})`);
    if (total !== null && !near(ownerCol, total)) issues.push(`Σintest≠Total (${ownerCol}/${total})`);
    for (const o of ['antonio', 'michela', 'shared']) {
      const col = num(row[PCOL[o]]);
      if (col !== null && !near(r2(byOwner[o]), col))
        issues.push(`${o} conti≠col (${r2(byOwner[o])}/${col})`);
    }
    if (app && total !== null && appNW !== null && !near(total, appNW))
      issues.push(`Excel≠app (${total}/${appNW})`);
    if (issues.length) flag('Patrimonio', key, issues.join(' · '));
    rows.push([key, total, appNW, total !== null && appNW !== null ? total - appNW : null, sum, ownerCol, issues.length ? issues.join(' · ') : 'OK']);
  }
  writeCsv('patrimonio.csv', ['Mese', 'Total Excel', 'netWorth app', 'Δ', 'Σ voci', 'Σ intestatari', 'Esito'], rows);
}

// ===========================================================================
// 2) CASH FLOW (CashFlow ↔ cashFlow)
// ===========================================================================
console.log('2) Cash flow (CashFlow ↔ cashFlow)');
const cf = grid('CashFlow');
const CF = { mese: 43, gross: 44, income: 46, expenses: 48, tax: 50, saved: 52 };
{
  const rows = [];
  const meseRow = cf[CF.mese] || [];
  for (let c = 1; c < meseRow.length; c++) {
    const key = mk(meseRow[c]);
    if (!key) continue;
    const g = num(cf[CF.gross]?.[c]), inc = num(cf[CF.income]?.[c]);
    const out = num(cf[CF.expenses]?.[c]), tax = num(cf[CF.tax]?.[c]), sav = num(cf[CF.saved]?.[c]);
    if (g === null && inc === null && out === null && sav === null) continue;
    const a = app?.cashFlow.get(key);
    const issues = [];
    if (inc !== null && out !== null && sav !== null && !near(sav, inc - out))
      issues.push(`saved≠in−out (${sav}/${r2(inc - out)})`);
    if (g !== null && inc !== null && tax !== null && !near(tax, g - inc, 2))
      issues.push(`tax≠lordo−netto (${tax}/${r2(g - inc)})`);
    if (app && a) {
      for (const [f, ex] of [['gross', g], ['income', inc], ['expenses', out], ['saved', sav]]) {
        const av = appNum(a, f);
        if (ex !== null && av !== null && !near(ex, av)) issues.push(`${f} Excel≠app (${ex}/${av})`);
      }
    }
    if (issues.length) flag('Cash flow', key, issues.join(' · '));
    rows.push([key, g, appNum(a, 'gross'), inc, appNum(a, 'income'), out, appNum(a, 'expenses'), sav, appNum(a, 'saved'), issues.length ? issues.join(' · ') : 'OK']);
  }
  writeCsv('cashflow.csv', ['Mese', 'Lordo Excel', 'Lordo app', 'Netto Excel', 'Netto app', 'Uscite Excel', 'Uscite app', 'Risparmio Excel', 'Risparmio app', 'Esito'], rows);
}

// ===========================================================================
// 3) TRACK RECORD (Azionario ↔ portfolioHistory)
// ===========================================================================
console.log('3) Track record (Azionario ↔ portfolioHistory)');
const az = grid('Azionario');
const TR = { mese: 84, div: 86, chCum: 87, aperte: 88, totale: 89, valore: 91, investito: 92 };
{
  const rows = [];
  const meseRow = az[TR.mese] || [];
  for (let c = 1; c < meseRow.length; c++) {
    const key = mk(meseRow[c]);
    if (!key) continue;
    const val = num(az[TR.valore]?.[c]), inv = num(az[TR.investito]?.[c]);
    const ap = num(az[TR.aperte]?.[c]), ch = num(az[TR.chCum]?.[c]), tot = num(az[TR.totale]?.[c]);
    if (val === null && inv === null) continue;
    const a = app?.portfolioHistory.get(key);
    const issues = [];
    if (ap !== null && val !== null && inv !== null && !near(ap, val - inv))
      issues.push(`APERTE≠val−inv (${ap}/${r2(val - inv)})`);
    if (tot !== null && ch !== null && ap !== null && !near(tot, ch + ap))
      issues.push(`TOTALE≠chCum+APERTE (${tot}/${r2(ch + ap)})`);
    if (app && a) {
      if (val !== null && appNum(a, 'value') !== null && !near(val, appNum(a, 'value')))
        issues.push(`valore Excel≠app (${val}/${appNum(a, 'value')})`);
      if (inv !== null && appNum(a, 'invested') !== null && !near(inv, appNum(a, 'invested')))
        issues.push(`investito Excel≠app (${inv}/${appNum(a, 'invested')})`);
    }
    if (issues.length) flag('Track record', key, issues.join(' · '));
    rows.push([key, val, appNum(a, 'value'), inv, appNum(a, 'invested'), ap, appNum(a, 'openPL'), ch, appNum(a, 'realized'), issues.length ? issues.join(' · ') : 'OK']);
  }
  writeCsv('track-record.csv', ['Mese', 'Valore Excel', 'Valore app', 'Investito Excel', 'Investito app', 'APERTE Excel', 'openPL app', 'Realizz.cum Excel', 'realized app', 'Esito'], rows);
}

// ===========================================================================
// 4) PORTAFOGLIO posizioni correnti (Azionario ↔ holdings) — qty/PMC stabili;
//    valore/P&L dipendono dalla data del prezzo → solo informativi.
// ===========================================================================
console.log('4) Portafoglio posizioni (Azionario ↔ holdings)');
{
  const insBy = new Map((app?.instruments ?? []).map((i) => [i.id ?? i.symbol, i]));
  const base = (s) => String(s || '').split('.')[0].toUpperCase();
  const appPos = new Map(); // base symbol → {qty, avgCost}
  for (const h of app?.holdings ?? []) {
    const ins = insBy.get(h.instrumentId);
    appPos.set(base(ins?.symbol ?? h.instrumentId), { qty: h.quantity, pmc: h.avgCost });
  }
  const rows = [];
  for (let r = 5; r < 26; r++) {
    const sym = typeof az[r]?.[0] === 'string' ? az[r][0].trim() : null;
    if (sym && sym.toUpperCase() === 'TOTALE') break;
    if (!sym) continue; // riga vuota / blocco model portfolio (col A vuota) → salta, non interrompe
    const qty = num(az[r][1]), pmc = num(az[r][2]), val = num(az[r][4]);
    if (qty === null) continue;
    const a = appPos.get(base(sym));
    const issues = [];
    if (app) {
      if (!a) issues.push('assente in app');
      else {
        if (!near(qty, a.qty, 0.01)) issues.push(`qty Excel≠app (${qty}/${a.qty})`);
        if (pmc !== null && !near(pmc, a.pmc, 0.02)) issues.push(`PMC Excel≠app (${pmc}/${a.pmc})`);
      }
    }
    if (issues.length) flag('Portafoglio', sym, issues.join(' · '));
    rows.push([sym, qty, a?.qty ?? null, pmc, a?.pmc ?? null, val, issues.length ? issues.join(' · ') : 'OK']);
  }
  writeCsv('portafoglio.csv', ['Titolo', 'Qty Excel', 'Qty app', 'PMC Excel', 'PMC app', 'Valore Excel (18/05/25)', 'Esito'], rows);
}

// ===========================================================================
// RIEPILOGO ANOMALIE
// ===========================================================================
console.log('\n=== ANOMALIE ===');
if (!anomalies.length) {
  console.log('✓ Nessuna anomalia: Excel coerente e (se confrontato) allineato all’app.');
} else {
  for (const a of anomalies) console.log(`  ⚠ [${a.sheet}] ${a.key}: ${a.msg}`);
  console.log(`\n${anomalies.length} anomalia/e. NB: i refusi noti di 2024-09 (subtotale Condiviso, APERTE) sono attesi.`);
}
console.log('\nCSV in data/audit/ (gitignorato): apribili in Excel per il controllo a vista.');
process.exit(0);
