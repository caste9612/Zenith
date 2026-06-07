import { inject, Injectable } from '@angular/core';
import {
  AccountsRepository,
  CashFlowRepository,
  HoldingsRepository,
  InstrumentsRepository,
  PortfolioHistoryRepository,
  RealizedTradesRepository,
  SnapshotsRepository,
  TransactionsRepository,
} from '../data';
import {
  cashflowSheet,
  movimentiSheet,
  patrimonioSheet,
  portfolioSheet,
  realizedSheet,
  riepilogoSheet,
  trackRecordSheet,
  SheetData,
} from './sheets';

/**
 * Export di tutti i dati dell'app in un `.xlsx` (backup + sostituzione dell'Excel). **Lato client**:
 * legge le collezioni dai repository, rende i fogli con **ExcelJS** (import dinamico → fuori dal
 * bundle iniziale) e scarica il file. Lo *shaping* dati→righe è in `sheets.ts` (puro, testato).
 */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly accountsRepo = inject(AccountsRepository);
  private readonly snapshotsRepo = inject(SnapshotsRepository);
  private readonly holdingsRepo = inject(HoldingsRepository);
  private readonly instrumentsRepo = inject(InstrumentsRepository);
  private readonly txRepo = inject(TransactionsRepository);
  private readonly realizedRepo = inject(RealizedTradesRepository);
  private readonly historyRepo = inject(PortfolioHistoryRepository);
  private readonly cashflowRepo = inject(CashFlowRepository);

  /** Genera e scarica il workbook con tutti i dati dell'app. */
  async exportWorkbook(): Promise<void> {
    const [accounts, snapshots, holdings, instruments, transactions, realized, history, cashflow] =
      await Promise.all([
        this.accountsRepo.listOrdered(),
        this.snapshotsRepo.listByDate(),
        this.holdingsRepo.list(),
        this.instrumentsRepo.list(),
        this.txRepo.list(),
        this.realizedRepo.list(),
        this.historyRepo.list(),
        this.cashflowRepo.list(),
      ]);
    const byDate = (a: { date: Date }, b: { date: Date }) => a.date.getTime() - b.date.getTime();
    realized.sort(byDate);
    history.sort(byDate);
    cashflow.sort(byDate);

    const sheets: SheetData[] = [
      riepilogoSheet(accounts, snapshots),
      patrimonioSheet(accounts, snapshots),
      portfolioSheet(holdings, instruments),
      movimentiSheet(transactions, instruments),
      realizedSheet(realized),
      trackRecordSheet(history),
      cashflowSheet(cashflow),
    ];

    // ExcelJS è pesante: caricato solo qui, on demand.
    const mod = (await import('exceljs')) as unknown as { default?: unknown };
    const ExcelJS = (mod.default ?? mod) as { Workbook: new () => ExcelWorkbook };
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Zenith';
    wb.created = new Date();
    for (const s of sheets) this.render(wb, s);

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    this.download(blob, `zenith-${this.today()}.xlsx`);
  }

  /** Rende un SheetData in un foglio: intestazione, righe, formati €/%/data, larghezze, freeze. */
  private render(wb: ExcelWorkbook, s: SheetData): void {
    const ws = wb.addWorksheet(s.name);
    ws.addRow(s.headers);
    for (const r of s.rows) ws.addRow(r);

    const head = ws.getRow(1);
    head.font = { bold: true };
    head.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const eur = new Set(s.eurColumns ?? []);
    const pct = new Set(s.pctColumns ?? []);
    const dat = new Set(s.dateColumns ?? []);
    s.headers.forEach((header, i) => {
      const col = ws.getColumn(i + 1);
      col.width = Math.min(30, Math.max(10, header.length + 2));
      if (eur.has(i)) col.numFmt = '#,##0 €';
      else if (pct.has(i)) col.numFmt = '0.0%';
      else if (dat.has(i)) col.numFmt = 'mmm yyyy';
    });
  }

  /** Download lato browser (web/PWA). Su desktop Tauri il "salva con nome" arriva in Fase 4. */
  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  private today(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
}

// Tipi minimi di ExcelJS che usiamo (l'import è dinamico, niente type import statico).
interface ExcelCell {
  fill: unknown;
}
interface ExcelRow {
  font: unknown;
  eachCell(cb: (c: ExcelCell) => void): void;
}
interface ExcelColumn {
  width: number;
  numFmt: string;
}
interface ExcelWorksheet {
  addRow(values: unknown[]): unknown;
  getRow(i: number): ExcelRow;
  getColumn(i: number): ExcelColumn;
  views: unknown;
}
interface ExcelWorkbook {
  creator: string;
  created: Date;
  addWorksheet(name: string): ExcelWorksheet;
  xlsx: { writeBuffer(): Promise<ArrayBuffer> };
}
