/** Una quotazione recuperata da un provider. */
export interface Quote {
  symbol: string;
  /** Prezzo nella valuta dello strumento. */
  price: number;
  /** Chiusura del giorno precedente (per la variazione a 1 giorno), se disponibile. */
  prevClose?: number;
  currency: string;
  /** Momento del recupero. */
  at: Date;
}
