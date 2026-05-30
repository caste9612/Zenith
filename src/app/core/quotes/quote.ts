/** Una quotazione recuperata da un provider. */
export interface Quote {
  symbol: string;
  /** Prezzo nella valuta dello strumento. */
  price: number;
  currency: string;
  /** Momento del recupero. */
  at: Date;
}
