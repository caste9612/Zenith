import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Instrument, QuoteProviderId } from '../models';
import { platformFetch } from '../platform/tauri';
import { Quote } from './quote';
import { QuoteProvider, symbolForProvider } from './quote-provider';

/**
 * Provider Finnhub per azioni/ETF (free tier ~60 chiamate/min).
 * NB: il mapping dei ticker del broker verso i simboli Finnhub e la gestione
 * valuta verranno rifiniti in Fase 1 (refresh quotazioni). Qui c'è l'ossatura.
 */
@Injectable({ providedIn: 'root' })
export class FinnhubProvider implements QuoteProvider {
  readonly id: QuoteProviderId = 'finnhub';

  supports(instrument: Instrument): boolean {
    return (
      symbolForProvider(instrument, this.id) !== undefined &&
      (instrument.assetType === 'equity' || instrument.assetType === 'etf')
    );
  }

  async getQuote(instrument: Instrument): Promise<Quote | null> {
    if (!environment.finnhubApiKey) return null;
    const symbol = symbolForProvider(instrument, this.id);
    if (!symbol) return null;
    const url =
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}` +
      `&token=${environment.finnhubApiKey}`;
    const res = await platformFetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { c?: number; pc?: number };
    if (typeof data.c !== 'number' || data.c === 0) return null;
    return {
      symbol: instrument.symbol,
      price: data.c,
      prevClose: typeof data.pc === 'number' && data.pc > 0 ? data.pc : undefined,
      currency: instrument.currency,
      at: new Date(),
    };
  }
}
