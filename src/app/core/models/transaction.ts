/** Tipo di movimento. */
export type TransactionType = 'buy' | 'sell' | 'dividend' | 'deposit' | 'withdraw' | 'valuation';

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  buy: 'Acquisto',
  sell: 'Vendita',
  dividend: 'Dividendo',
  deposit: 'Deposito',
  withdraw: 'Prelievo',
  valuation: 'Valorizzazione',
};

/**
 * Un movimento: acquisto, vendita (totale o parziale), dividendo, deposito/prelievo
 * o valorizzazione manuale. Base per il calcolo di P&L e per lo storico.
 */
export interface Transaction {
  id?: string;
  date: Date;
  type: TransactionType;
  /** Riferimenti, valorizzati a seconda del tipo. */
  holdingId?: string;
  accountId?: string;
  instrumentId?: string;
  /** Per buy/sell. */
  quantity?: number;
  price?: number;
  /** Importo nella valuta dello strumento/conto. */
  amount: number;
  currency: string;
  fees?: number;
  notes?: string;
}
