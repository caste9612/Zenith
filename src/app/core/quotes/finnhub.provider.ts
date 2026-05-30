import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Instrument } from '../models';
import { platformFetch } from '../platform/tauri';
import { Quote } from './quote';
import { QuoteProvider } from './quote-provider';

/**
 * Provider Finnhub per azioni/ETF (free tier ~60 chiamate/min).
 * NB: il mapping dei ticker del broker verso i simboli Finnhub e la gestione
 * valuta verranno rifiniti in Fase 1 (refresh quotazioni). Qui c'è l'ossatura.
 */
@Injectable({ providedIn: 'root' })
export class FinnhubProvider implements QuoteProvider {
  readonly id = 'finnhub';

  supports(instrument: Instrument): boolean {
    return (
      instrument.provider === 'finnhub' &&
      (instrument.assetType === 'equity' || instrument.assetType === 'etf')
    );
  }

  async getQuote(instrument: Instrument): Promise<Quote | null> {
    if (!environment.finnhubApiKey) return null;
    const url =
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(instrument.symbol)}` +
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
