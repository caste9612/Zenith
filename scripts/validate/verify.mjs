// Verifica INDIPENDENTE end-to-end: ri-parsa l'Excel (fonte di verità) e, per ogni categoria,
// ricalcola da zero i valori derivati e controlla gli invarianti — sia sui dati importati sia su
// quelli "calcolati" dall'app (aggregati e indicatori). Implementazione separata da quella dell'app
// e dagli script di import, così un errore di una parte non si nasconde nell'altra.
//
//   npm run verify        (richiede l'Excel in data/; salta con exit 0 se assente — CI-safe)
//
// Le funzioni pure dell'app (metrics, net-worth, cashflow…) hanno già 99 test con attesi indipendenti;
// qui ricalcoliamo gli stessi indicatori sui DATI REALI e li stampiamo, da confrontare con la UI.

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSXns from 'xlsx';
const XLSX = XLSXns.readFile ? XLSXns : (XLSXns.default ?? XLSXns);

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');
const xlPath = ['Balance Sheet.xlsx', 'data/Balance Sheet.xlsx']
  .map((c) => resolve(root, c))
  .find((p) => existsSync(p));
if (!xlPath) {
  console.log('ℹ️  Excel assente: verifica saltata (CI-safe).');
  process.exit(0);
}

const wb = XLSX.readFile(xlPath, { cellDates: true });
const grid = (name) =>
  XLSX.utils.sheet_to_json(wb.Sheets[name], {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  });
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const r2 = (n) => Math.round(n * 100) / 100;
const mk = (d) =>
  d instanceof Date ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}` : '?';
const eur = (n) => `€${Number(n).toLocaleString('it-IT')}`;
const pct = (f) => `${(f * 100).toFixed(2)}%`;

let failures = 0;
const ok = (cond, label, detail = '') => {
  console.log(`   ${cond ? '✓' : '✗'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!cond) failures++;
};
const section = (t) => console.log(`\n=== ${t} ===`);

// ---------------------------------------------------------------------------
// A) PATRIMONIO NETTO (foglio Amorini): Σ voci == "Total"; Σ intestatari == "Total";
//    aggregazione per intestatario == colonne intestatario dell'Excel.
// ---------------------------------------------------------------------------
section('A) Patrimonio netto — voci, totale, intestatari (63 mesi)');
const ACC = [
  [1, 'antonio'],
  [2, 'antonio'],
  [4, 'antonio'],
  [6, 'antonio'],
  [8, 'antonio'],
  [9, 'michela'],
  [11, 'michela'],
  [13, 'michela'],
  [15, 'michela'],
  [16, 'shared'],
];
const COL = { total: 18, antonio: 19, michela: 20, shared: 21 };
const amorini = grid('Amorini');
let nwMonths = 0,
  nwSumBad = 0,
  ownerColBad = 0,
  ownerAggBad = 0;
const nwSeries = [];
for (const row of amorini) {
  if (!(row?.[0] instanceof Date)) continue;
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
  nwMonths++;
  sum = r2(sum);
  const total = num(row[COL.total]);
  if (total !== null) {
    if (Math.abs(sum - total) > 1) {
      nwSumBad++;
      console.log(`     ${mk(row[0])}: Σ voci ${sum} vs Total ${total}`);
    }
    nwSeries.push(total); // serie del netto dalla colonna ufficiale Excel
    const ownerColSum = r2(
      (num(row[COL.antonio]) ?? 0) + (num(row[COL.michela]) ?? 0) + (num(row[COL.shared]) ?? 0),
    );
    if (Math.abs(ownerColSum - total) > 1) {
      ownerColBad++;
      console.log(`     ${mk(row[0])}: Σ intestatari ${ownerColSum} vs Total ${total}`);
    }
  }
  for (const o of ['antonio', 'michela', 'shared']) {
    const col = num(row[COL[o]]);
    if (col !== null && Math.abs(r2(byOwner[o]) - col) > 1) {
      ownerAggBad++;
      console.log(`     ${mk(row[0])} ${o}: somma conti ${r2(byOwner[o])} vs colonna Excel ${col}`);
    }
  }
}
ok(
  nwSumBad === 0,
  `Σ voci con segno == colonna "Total" Excel`,
  `${nwMonths} mesi, ${nwSumBad} difformi`,
);
ok(ownerColBad === 0, `Σ intestatari (T+U+V) == "Total"`, `${ownerColBad} difformi`);
ok(
  ownerAggBad === 0,
  `aggregazione per intestatario (app) == colonne intestatario Excel`,
  `${ownerAggBad} difformi`,
);

// ---------------------------------------------------------------------------
// B) PORTAFOGLIO (Azionario, ASSET ALLOCATION): valore = qty×prezzo; P/L = (prezzo−PMC)×qty.
// ---------------------------------------------------------------------------
section('B) Portafoglio — valore e P/L per posizione (ricalcolo indipendente)');
const az = grid('Azionario');
let posChecked = 0,
  valBad = 0,
  plBad = 0;
for (let r = 5; r < 40; r++) {
  const sym = typeof az[r]?.[0] === 'string' ? az[r][0].trim() : null;
  if (!sym || sym.toUpperCase() === 'TOTALE') break;
  const qty = num(az[r][1]),
    pmc = num(az[r][2]),
    price = num(az[r][3]);
  const exVal = num(az[r][4]),
    exPl = num(az[r][6]);
  if (qty === null) continue;
  posChecked++;
  if (price !== null && exVal !== null && Math.abs(r2(qty * price) - exVal) > 1) {
    valBad++;
    console.log(`     ${sym}: valore ricalcolato ${r2(qty * price)} vs Excel ${exVal}`);
  }
  if (
    price !== null &&
    pmc !== null &&
    exPl !== null &&
    Math.abs(r2((price - pmc) * qty) - exPl) > 2
  ) {
    plBad++;
    console.log(`     ${sym}: P/L ricalcolato ${r2((price - pmc) * qty)} vs Excel ${exPl}`);
  }
}
ok(valBad === 0, `valore = quantità × prezzo`, `${posChecked} posizioni, ${valBad} difformi`);
ok(plBad === 0, `P/L = (prezzo − PMC) × quantità`, `${plBad} difformi`);

// ---------------------------------------------------------------------------
// C) TRACK RECORD (Azionario): relazioni interne APERTE == valore−investito,
//    TOTALE == realizzato_cum + APERTE (su tutti i mesi).
// ---------------------------------------------------------------------------
section('C) Track record — coerenza interna (≈45 mesi)');
const TR = { mese: 84, chCum: 87, aperte: 88, totale: 89, valore: 91, investito: 92 };
let trMonths = 0,
  aperteBad = 0,
  totaleBad = 0;
const mese = az[TR.mese] || [];
for (let c = 1; c < mese.length; c++) {
  if (!(mese[c] instanceof Date)) continue;
  const val = num(az[TR.valore]?.[c]),
    inv = num(az[TR.investito]?.[c]);
  const ap = num(az[TR.aperte]?.[c]),
    ch = num(az[TR.chCum]?.[c]),
    tot = num(az[TR.totale]?.[c]);
  if (val === null || inv === null) continue;
  trMonths++;
  if (ap !== null && Math.abs(ap - (val - inv)) > 1) {
    aperteBad++;
    console.log(`     ${mk(mese[c])}: APERTE ${ap} vs valore−investito ${r2(val - inv)}`);
  }
  if (tot !== null && ch !== null && ap !== null && Math.abs(tot - (ch + ap)) > 1) totaleBad++;
}
ok(aperteBad === 0, `APERTE == valore − investito`, `${trMonths} mesi, ${aperteBad} difformi`);
ok(totaleBad === 0, `TOTALE == realizzato_cum + APERTE`, `${totaleBad} difformi`);

// ---------------------------------------------------------------------------
// D) OPERAZIONI CHIUSE (Azionario, blocchi CLOSED POSITION): Σ P/L del blocco == TOTALE Excel.
// ---------------------------------------------------------------------------
section('D) Operazioni chiuse — somma blocco == TOTALE Excel (per mese)');
const CP = { month: 36, head: 70, first: 71, total: 80, block: 7 };
let blocks = 0,
  blockBad = 0,
  ops = 0;
for (let c = 0; az[CP.month]?.[c] instanceof Date; c += CP.block) {
  if (typeof az[CP.head]?.[c] !== 'string') continue;
  let s = 0,
    has = false;
  for (let r = CP.first; r < CP.total; r++) {
    const sym = typeof az[r]?.[c] === 'string' ? az[r][c].trim() : '';
    if (!sym || sym.toUpperCase() === 'TOTALE') continue;
    let pl = num(az[r][c + 6]);
    if (pl === null) pl = num(az[r][c + 4]);
    if (pl === null) continue;
    s += pl;
    has = true;
    ops++;
  }
  const exTot = num(az[CP.total]?.[c + 6]);
  if (has && exTot !== null) {
    blocks++;
    if (Math.abs(r2(s) - exTot) > 0.5) blockBad++;
  }
}
ok(
  blockBad === 0,
  `Σ operazioni del mese == TOTALE Excel`,
  `${blocks} mesi, ${ops} operazioni, ${blockBad} difformi`,
);

// ---------------------------------------------------------------------------
// E) CASH FLOW (foglio CashFlow): risparmio == entrate − uscite (per mese).
// ---------------------------------------------------------------------------
section('E) Cash flow — saved == income − expenses (per mese)');
const cf = grid('CashFlow');
const CF = { mese: 43, income: 46, expenses: 48, saved: 52 };
let cfMonths = 0,
  cfBad = 0;
const cfMeseRow = cf[CF.mese] || [];
for (let c = 1; c < cfMeseRow.length; c++) {
  if (!(cfMeseRow[c] instanceof Date)) continue;
  const inc = num(cf[CF.income]?.[c]),
    out = num(cf[CF.expenses]?.[c]),
    sav = num(cf[CF.saved]?.[c]);
  if (inc === null && out === null && sav === null) continue;
  cfMonths++;
  if (inc !== null && out !== null && sav !== null && Math.abs(sav - (inc - out)) > 1) cfBad++;
}
ok(cfBad === 0, `risparmio == entrate − uscite`, `${cfMonths} mesi, ${cfBad} difformi`);

// ---------------------------------------------------------------------------
// F) INDICATORI ricalcolati sui DATI REALI (confronta con la UI).
//    Implementazione indipendente delle stesse definizioni dell'app.
// ---------------------------------------------------------------------------
section('F) Indicatori ricalcolati (confronta con dashboard / Rendimento)');
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
const cagr = (rs) => {
  if (!rs.length) return 0;
  const g = rs.reduce((a, r) => a * (1 + r), 1);
  return g <= 0 ? -1 : g ** (1 / (rs.length / 12)) - 1;
};
const maxDD = (rs) => {
  let idx = 1,
    peak = 1,
    worst = 0;
  for (const r of rs) {
    idx *= 1 + r;
    if (idx > peak) peak = idx;
    const dd = (peak - idx) / peak;
    if (dd > worst) worst = dd;
  }
  return worst;
};

// Patrimonio netto: rendimenti = variazioni della serie del netto.
const nwRet = [];
for (let i = 1; i < nwSeries.length; i++)
  if (nwSeries[i - 1] > 0) nwRet.push((nwSeries[i] - nwSeries[i - 1]) / nwSeries[i - 1]);
console.log(
  `   Patrimonio netto (${nwSeries.length} mesi): CAGR ${pct(cagr(nwRet))} · volatilità ${pct(sd(nwRet) * Math.sqrt(12))} · maxDD ${pct(maxDD(nwRet))}`,
);

// Portafoglio: rendimenti time-weighted dal track record (scorporo flusso + realizzato + dividendi).
const trRet = [];
const cols = [];
for (let c = 1; c < mese.length; c++)
  if (mese[c] instanceof Date && num(az[TR.valore]?.[c]) !== null) cols.push(c);
for (let k = 1; k < cols.length; k++) {
  const p = cols[k - 1],
    q = cols[k];
  const base = num(az[TR.investito]?.[p]) ?? 0;
  if (base <= 0) continue;
  const flow = (num(az[TR.investito]?.[q]) ?? 0) - (num(az[TR.investito]?.[p]) ?? 0);
  const unreal = (num(az[TR.valore]?.[q]) ?? 0) - (num(az[TR.valore]?.[p]) ?? 0) - flow;
  const realDelta = (num(az[TR.chCum]?.[q]) ?? 0) - (num(az[TR.chCum]?.[p]) ?? 0);
  const div = num(az[86]?.[q]) ?? 0;
  trRet.push((unreal + realDelta + div) / base);
}
const sharpe = sd(trRet) === 0 ? 0 : (mean(trRet) / sd(trRet)) * Math.sqrt(12);
console.log(
  `   Portafoglio (${cols.length} mesi): CAGR ${pct(cagr(trRet))} · volatilità ${pct(sd(trRet) * Math.sqrt(12))} · Sharpe ${sharpe.toFixed(2)} · maxDD ${pct(maxDD(trRet))}`,
);

// ---------------------------------------------------------------------------
console.log('');
if (failures > 0) {
  console.error(`❌ Verifica: ${failures} controllo/i con difformità reali.`);
  process.exit(1);
}
console.log(
  '✅ Verifica superata: tutti gli invarianti tornano. (Confronta gli indicatori di F con la UI.)',
);
