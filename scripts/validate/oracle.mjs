// Validazione "oracolo" LOCALE: verifica che i numeri calcolati dall'app riproducano quelli
// reali dell'Excel, leggendo data/seed.json (gitignorato, generato da `npm run import:parse`).
//
// È COMMITTATO ma NON gira in CI pubblica: se il seed manca esce con successo (skip), così non
// fallisce dove i dati reali non esistono. Eseguilo in locale prima del push quando cambiano gli
// import o la logica di calcolo (vedi docs/08-testing.md).
//
//   npm run import:parse && npm run validate:oracle
//
// Invarianti controllati:
//   A) coerenza interna  — Σ(valori, con segno per le passività) == netWorth scritto dal parser
//   B) oracolo Excel     — netWorth == colonna "Total" dell'Excel (netWorthExcel), entro 1 €
//   C) cross-check       — valore voce "Azionario" ≈ Σ(quantità × ultimo prezzo) del portafoglio
//                          (informativo: le due fonti possono avere date di aggiornamento diverse)

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');
const seedPath = resolve(root, 'data/seed.json');

const TOL_INTERNAL = 0.01; // arrotondamento
const TOL_EXCEL = 1; // 1 € come nel parser
const eur = (n) => `€ ${Number(n).toLocaleString('it-IT')}`;
const round2 = (n) => Math.round(n * 100) / 100;

if (!existsSync(seedPath)) {
  console.log('ℹ️  data/seed.json assente: validazione oracolo saltata.');
  console.log('   Genera il seed con `npm run import:parse` (richiede l’Excel in data/).');
  process.exit(0); // skip pulito: non è un errore (CI pubblica, niente dati reali)
}

const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const accounts = seed.accounts ?? [];
const snapshots = seed.snapshots ?? [];
const holdings = seed.holdings ?? [];
const instruments = seed.instruments ?? [];

let failures = 0;

// --- A) coerenza interna + B) oracolo Excel --------------------------------
const internalBad = [];
const excelBad = [];
let excelChecked = 0;

for (const s of snapshots) {
  const recomputed = round2(
    accounts.reduce((sum, a) => {
      const v = s.values?.[a.id] ?? 0;
      return sum + (a.isLiability ? -v : v);
    }, 0),
  );
  if (Math.abs(recomputed - s.netWorth) > TOL_INTERNAL) {
    internalBad.push({ month: s.id, recomputed, parser: s.netWorth });
  }
  if (s.netWorthExcel !== null && s.netWorthExcel !== undefined) {
    excelChecked++;
    if (Math.abs(recomputed - s.netWorthExcel) > TOL_EXCEL) {
      excelBad.push({ month: s.id, recomputed, excel: s.netWorthExcel });
    }
  }
}

console.log(`Snapshot: ${snapshots.length}  (${snapshots[0]?.id} → ${snapshots.at(-1)?.id})`);
console.log('');

console.log('A) Coerenza interna (Σ voci con segno == netWorth del parser)');
if (internalBad.length === 0) {
  console.log(`   ✓ OK su tutti i ${snapshots.length} mesi`);
} else {
  failures++;
  console.log(`   ✗ ${internalBad.length} mesi divergenti:`);
  for (const b of internalBad.slice(0, 8))
    console.log(`     ${b.month}: ricalcolato ${b.recomputed} vs parser ${b.parser}`);
}
console.log('');

console.log('B) Oracolo Excel (netWorth == colonna "Total", entro 1 €)');
if (excelChecked === 0) {
  console.log('   ℹ️  nessun valore Excel di confronto nel seed');
} else if (excelBad.length === 0) {
  console.log(`   ✓ OK su tutti i ${excelChecked} mesi con valore Excel`);
} else {
  failures++;
  console.log(`   ✗ ${excelBad.length}/${excelChecked} mesi divergenti:`);
  for (const b of excelBad.slice(0, 8))
    console.log(
      `     ${b.month}: app ${b.recomputed} vs Excel ${b.excel} (Δ ${round2(b.recomputed - b.excel)})`,
    );
}
console.log('');

// --- C) cross-check portafoglio ↔ voce "Azionario" -------------------------
console.log('C) Cross-check portafoglio ↔ voce "Azionario" (informativo)');
const priceBySymbol = new Map(instruments.map((i) => [i.symbol, i.lastPrice]));
let portfolioValue = 0;
let missingPrice = 0;
for (const h of holdings) {
  const price = priceBySymbol.get(h.instrumentSymbol);
  if (typeof price === 'number') portfolioValue += h.quantity * price;
  else missingPrice++;
}
portfolioValue = round2(portfolioValue);
const latest = snapshots.at(-1);
const azionario = latest?.values?.['azionario'];
if (azionario === undefined) {
  console.log('   ℹ️  nessun valore "Azionario" nell’ultimo snapshot');
} else {
  const diff = round2(portfolioValue - azionario);
  const pct = azionario ? Math.abs(diff / azionario) * 100 : 0;
  console.log(`   Portafoglio (Σ qty × prezzo): ${eur(portfolioValue)}`);
  console.log(`   Voce "Azionario" (${latest.id}):  ${eur(azionario)}`);
  console.log(
    `   Δ ${eur(diff)} (${pct.toFixed(1)}%)${missingPrice ? `  · ${missingPrice} titoli senza prezzo` : ''}`,
  );
  console.log('   (le due fonti hanno date di aggiornamento diverse: scostamento atteso)');
}
console.log('');

if (failures > 0) {
  console.error(`❌ Validazione oracolo: ${failures} blocco/i con divergenze reali.`);
  process.exit(1);
}
console.log('✅ Validazione oracolo superata.');
