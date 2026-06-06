import { Injectable } from '@angular/core';
import { Instrument, QuoteProviderId } from '../models';
import { isTauri, platformFetch } from '../platform/tauri';
import { Quote } from './quote';
import { QuoteProvider, symbolForProvider } from './quote-provider';

/** Metadati di prezzo nella risposta chart di Yahoo (i soli campi che leggiamo). */
export interface YahooMeta {
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  currency?: string;
}

/** Forma (parziale) della risposta dell'endpoint chart di Yahoo Finance. */
export interface YahooChartResponse {
  chart?: {
    result?: Array<{ meta?: YahooMeta }> | null;
    error?: unknown;
  };
}

/**
 * Provider Yahoo Finance: copre quasi tutti i mercati gratis (Euronext, Londra, Hong Kong…),
 * incluso ciò che Finnhub/Alpha Vantage free non coprono. Ma l'endpoint NON invia header CORS,
 * quindi è utilizzabile SOLO nell'app nativa Tauri (plugin HTTP, senza CORS), non nel browser.
 *
 * Per questo `supports()` è attivo solo dentro Tauri: nella web app i titoli marcati `yahoo`
 * restano intatti (come i manuali) senza generare errori CORS in console. Sull'app desktop/Android
 * vengono invece quotati. Il prezzo arriva nella valuta nativa del mercato: il QuoteService lo
 * converte in EUR al cambio corrente (come per Finnhub/Alpha Vantage).
 *
 * Simbolo = ticker Yahoo con suffisso mercato, es. "ENI.MI" (Milano), "TIBN.SW" (SIX, Svizzera),
 * "0001.HK" (Hong Kong). La verifica del simbolo giusto per ogni titolo e del comportamento
 * live va fatta on-device (vedi docs/09: TIBN/CKH/PHO/POL).
 */
@Injectable({ providedIn: 'root' })
export class YahooProvider implements QuoteProvider {
  readonly id: QuoteProviderId = 'yahoo';
  /** Endpoint cortese ma non documentato: distanzio un minimo le chiamate consecutive. */
  readonly minIntervalMs = 250;

  supports(instrument: Instrument): boolean {
    return (
      isTauri() && // solo app nativa: nel browser Yahoo è bloccato dalla CORS
      symbolForProvider(instrument, this.id) !== undefined &&
      (instrument.assetType === 'equity' || instrument.assetType === 'etf')
    );
  }

  async getQuote(instrument: Instrument): Promise<Quote | null> {
    if (!isTauri()) return null; // doppia guardia: niente fetch CORS dal browser
    const symbol = symbolForProvider(instrument, this.id);
    if (!symbol) return null;
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?range=1d&interval=1d`;
    const res = await platformFetch(url);
    if (!res.ok) return null;
    return parseYahooQuote((await res.json()) as YahooChartResponse, instrument);
  }
}

/**
 * Estrae la quotazione dalla risposta "chart" di Yahoo. Funzione PURA → testabile senza rete
 * né Tauri (vedi yahoo.provider.spec.ts). Ritorna null se la risposta non contiene un prezzo valido.
 */
export function parseYahooQuote(data: YahooChartResponse, instrument: Instrument): Quote | null {
  const meta = data.chart?.result?.[0]?.meta;
  if (!meta) return null; // simbolo non trovato / risposta di errore
  const price = meta.regularMarketPrice;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null;
  const prev = meta.chartPreviousClose ?? meta.previousClose;
  return {
    symbol: instrument.symbol,
    price,
    prevClose: typeof prev === 'number' && prev > 0 ? prev : undefined,
    // Yahoo risponde nella valuta nativa del mercato; il QuoteService converte in EUR.
    currency: meta.currency ?? instrument.currency,
    at: new Date(),
  };
}
