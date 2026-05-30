import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Instrument } from '../models';
import { platformFetch } from '../platform/tauri';
import { Quote } from './quote';
import { QuoteProvider } from './quote-provider';

/**
 * Provider Alpha Vantage per i mercati NON-USA (Euronext Amsterdam/Londra ecc.) che Finnhub
 * free non copre. Dati EOD (fine giornata) — adatto a un tracker personale. Free: 25 chiamate/
 * giorno, quindi va usato con parsimonia (cache + soglia di staliness ampia). Funziona dal
 * browser (CORS abilitato). Simboli con suffisso mercato, es. "FLOW.AMS" (vedi SYMBOL_SEARCH).
 */
@Injectable({ providedIn: 'root' })
export class AlphaVantageProvider implements QuoteProvider {
  readonly id = 'alphavantage';

  supports(instrument: Instrument): boolean {
    return (
      instrument.provider === 'alphavantage' &&
      (instrument.assetType === 'equity' || instrument.assetType === 'etf')
    );
  }

  async getQuote(instrument: Instrument): Promise<Quote | null> {
    if (!environment.alphaVantageApiKey) return null;
    const url =
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE` +
      `&symbol=${encodeURIComponent(instrument.symbol)}&apikey=${environment.alphaVantageApiKey}`;
    const res = await platformFetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { 'Global Quote'?: Record<string, string> };
    const q = data['Global Quote'];
    if (!q) return null; // simbolo non trovato o limite giornaliero raggiunto
    const price = parseFloat(q['05. price'] ?? '');
    if (!Number.isFinite(price) || price === 0) return null;
    const prev = parseFloat(q['08. previous close'] ?? '');
    return {
      symbol: instrument.symbol,
      price,
      prevClose: Number.isFinite(prev) && prev > 0 ? prev : undefined,
      currency: instrument.currency,
      at: new Date(),
    };
  }
}
