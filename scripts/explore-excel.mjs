// Strumento di SOLA ESPLORAZIONE (dev, locale): dà una radiografia di TUTTI i fogli dell'Excel
// per capire quali dati esistono e cosa l'app non mostra ancora. Non scrive file, stampa e basta.
//   node scripts/explore-excel.mjs            → panoramica + anteprima di ogni foglio
//   node scripts/explore-excel.mjs Amorini 60 → dump del foglio "Amorini" fino a 60 righe

import * as XLSXns from 'xlsx';
const XLSX = XLSXns.readFile ? XLSXns : (XLSXns.default ?? XLSXns);
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const candidates = ['Balance Sheet.xlsx', 'data/patrimonio.xlsx', 'data/Balance Sheet.xlsx'];
const xlPath = candidates.map((c) => resolve(root, c)).find((p) => existsSync(p));
if (!xlPath) {
  console.error('❌ Excel non trovato:', candidates.join(', '));
  process.exit(1);
}

const wb = XLSX.readFile(xlPath, { cellDates: true });
const onlySheet = process.argv[2];
const labelsMode = process.argv.includes('labels');
const maxRows = Number(process.argv[3] && process.argv[3] !== 'labels' ? process.argv[3] : 22);

const fmt = (v) => {
  if (v === null || v === undefined || v === '') return '·';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  let s = typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : String(v);
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > 16 ? s.slice(0, 15) + '…' : s;
};

// Colonne Excel: 0→A, 25→Z, 26→AA…
const colName = (i) => {
  let s = '';
  i += 1;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
};

console.log(`Excel: ${xlPath}`);
console.log(`Fogli (${wb.SheetNames.length}): ${wb.SheetNames.join(' · ')}`);
console.log('');

for (const name of wb.SheetNames) {
  if (onlySheet && name !== onlySheet) continue;
  const ws = wb.Sheets[name];
  const ref = ws['!ref'] || 'A1:A1';
  const range = XLSX.utils.decode_range(ref);
  const nRows = range.e.r + 1;
  const nCols = range.e.c + 1;
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });

  // Conta le colonne "non vuote" (con almeno un valore in tutto il foglio)
  const colHasData = new Array(nCols).fill(false);
  for (const row of grid) for (let c = 0; c < nCols; c++) if (row?.[c] != null && row[c] !== '') colHasData[c] = true;
  const usedCols = colHasData.filter(Boolean).length;

  console.log('═'.repeat(78));
  console.log(`▌ FOGLIO "${name}"  —  ${nRows} righe × ${nCols} colonne (colonne con dati: ${usedCols})`);
  console.log('═'.repeat(78));

  // Modalità "labels": per ogni riga non vuota, le prime celle con dato (Col=val) → scheletro.
  if (labelsMode) {
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r] || [];
      const cells = [];
      for (let c = 0; c < nCols && cells.length < 9; c++) {
        if (row[c] != null && row[c] !== '') cells.push(`${colName(c)}=${fmt(row[c])}`);
      }
      if (cells.length) console.log(String(r + 1).padStart(3) + ' │ ' + cells.join('  '));
    }
    console.log('');
    continue;
  }

  const rowsToShow = Math.min(grid.length, maxRows);
  const colsToShow = Math.min(nCols, 30);
  // intestazione colonne
  let header = '    ';
  for (let c = 0; c < colsToShow; c++) header += colName(c).padStart(8);
  console.log(header);
  for (let r = 0; r < rowsToShow; r++) {
    const row = grid[r] || [];
    let line = String(r + 1).padStart(3) + ' ';
    for (let c = 0; c < colsToShow; c++) line += fmt(row[c]).padStart(8);
    console.log(line);
  }
  if (grid.length > rowsToShow) console.log(`    … (${grid.length - rowsToShow} righe non mostrate)`);
  if (nCols > colsToShow) console.log(`    … (${nCols - colsToShow} colonne non mostrate)`);
  console.log('');
}
