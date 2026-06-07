/**
 * Flusso di cassa **mensile** del nucleo (importato dal foglio CashFlow dell'Excel). Sola lettura;
 * alimenta la pagina "Cash flow". Un documento per mese in users/{uid}/cashFlow (id YYYY-MM).
 * È un unico flusso di **nucleo** (non diviso per intestatario: l'Excel non ha quel dettaglio).
 */
export interface CashFlowMonth {
  id?: string; // YYYY-MM
  date: Date; // fine mese
  gross: number | null; // LORDO — entrata lorda
  income: number | null; // IN — entrata netta
  expenses: number | null; // OUT — uscite
  tax: number | null; // Tax — imposte/trattenute
  saved: number | null; // CashFlow — risparmio netto del mese (= income − expenses)
}
