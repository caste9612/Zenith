import { inject, Injectable } from '@angular/core';
import { HoldingsRepository, InstrumentsRepository, TransactionsRepository } from '../data';
import { Transaction } from '../models';

const round = (n: number, d = 4): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

export interface BuySellInput {
  symbol: string;
  name?: string;
  date: Date;
  quantity: number;
  amount: number; // importo totale (commissioni incluse)
}

export interface DividendInput {
  symbol: string;
  name?: string;
  date: Date;
  amount: number;
}

/**
 * Orchestratore del portafoglio. Le TRANSAZIONI sono la fonte di verità: dopo ogni
 * operazione la posizione (quantità + prezzo medio di carico) viene RICALCOLATA dai
 * movimenti col metodo del costo medio. Così acquisti/vendite/eliminazioni restano coerenti.
 * Il prezzo unitario di un'operazione è sempre importo/quantità (commissioni incluse).
 */
@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private readonly holdingsRepo = inject(HoldingsRepository);
  private readonly instrumentsRepo = inject(InstrumentsRepository);
  private readonly txRepo = inject(TransactionsRepository);

  /** Account/contenitore del portafoglio azionario (dallo schema importato). */
  private readonly accountId = 'azionario';

  /**
   * Valore corrente del portafoglio in EUR: somma di (quantità × prezzo corrente) di ogni
   * posizione. Il prezzo è `lastPrice` (auto, già convertito in EUR dal QuoteService) o
   * `manualPrice`, con fallback al costo medio. Usato per precompilare la voce "Azionario"
   * del nuovo snapshot (drill-down portafoglio → patrimonio).
   */
  async currentValueEur(): Promise<number> {
    const [holdings, instruments] = await Promise.all([
      this.holdingsRepo.list(),
      this.instrumentsRepo.list(),
    ]);
    const byId = new Map(instruments.map((i) => [i.id ?? i.symbol, i]));
    const total = holdings.reduce((sum, h) => {
      const ins = byId.get(h.instrumentId);
      const price = ins?.lastPrice ?? ins?.manualPrice ?? h.avgCost;
      return sum + h.quantity * price;
    }, 0);
    return round(total, 2);
  }

  /** Trova (o crea) lo strumento; ritorna l'id (= simbolo maiuscolo). */
  async ensureInstrument(symbol: string, name?: string): Promise<string> {
    const sym = symbol.trim().toUpperCase();
    const existing = (await this.instrumentsRepo.list()).find((i) => (i.id ?? i.symbol) === sym);
    if (existing) return existing.id ?? sym;
    await this.instrumentsRepo.upsert({
      id: sym,
      symbol: sym,
      name: name?.trim() || sym,
      assetType: 'equity',
      currency: 'EUR',
      provider: 'finnhub',
    });
    return sym;
  }

  async addBuy(input: BuySellInput): Promise<void> {
    const instrumentId = await this.ensureInstrument(input.symbol, input.name);
    await this.txRepo.upsert({
      date: input.date,
      type: 'buy',
      accountId: this.accountId,
      instrumentId,
      quantity: input.quantity,
      price: input.quantity ? input.amount / input.quantity : 0,
      amount: input.amount,
      currency: 'EUR',
    });
    await this.recompute(instrumentId);
  }

  async addSell(input: BuySellInput): Promise<void> {
    const instrumentId = await this.ensureInstrument(input.symbol, input.name);
    await this.txRepo.upsert({
      date: input.date,
      type: 'sell',
      accountId: this.accountId,
      instrumentId,
      quantity: input.quantity,
      price: input.quantity ? input.amount / input.quantity : 0,
      amount: input.amount,
      currency: 'EUR',
    });
    await this.recompute(instrumentId);
  }

  async addDividend(input: DividendInput): Promise<void> {
    const instrumentId = await this.ensureInstrument(input.symbol, input.name);
    await this.txRepo.upsert({
      date: input.date,
      type: 'dividend',
      accountId: this.accountId,
      instrumentId,
      amount: input.amount,
      currency: 'EUR',
    });
  }

  async deleteTransaction(tx: Transaction): Promise<void> {
    if (!tx.id) return;
    await this.txRepo.remove(tx.id);
    if ((tx.type === 'buy' || tx.type === 'sell') && tx.instrumentId) {
      await this.recompute(tx.instrumentId);
    }
  }

  /**
   * Ricalcola quantità e prezzo medio di carico di uno strumento dai suoi movimenti
   * (costo medio). Se la quantità arriva a 0, rimuove la posizione.
   */
  async recompute(instrumentId: string): Promise<void> {
    const txs = (await this.txRepo.list())
      .filter((t) => t.instrumentId === instrumentId && (t.type === 'buy' || t.type === 'sell'))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    let qty = 0;
    let basis = 0; // costo di carico totale
    for (const t of txs) {
      const q = t.quantity ?? 0;
      if (t.type === 'buy') {
        qty += q;
        basis += t.amount;
      } else if (qty > 0) {
        const avg = basis / qty;
        const sold = Math.min(q, qty);
        basis -= sold * avg;
        qty -= sold;
      }
    }

    const holdings = await this.holdingsRepo.list();
    const existing = holdings.find(
      (h) => h.instrumentId === instrumentId && h.accountId === this.accountId,
    );

    if (qty <= 0.000001) {
      if (existing?.id) await this.holdingsRepo.remove(existing.id);
      return;
    }

    await this.holdingsRepo.upsert({
      id: existing?.id,
      accountId: this.accountId,
      instrumentId,
      quantity: round(qty),
      avgCost: round(basis / qty),
      currency: 'EUR',
      priceMode: existing?.priceMode ?? 'auto',
    });
  }
}
