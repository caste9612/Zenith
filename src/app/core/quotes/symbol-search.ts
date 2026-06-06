import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AssetType, QuoteProviderId } from '../models';
import { isTauri, platformFetch } from '../platform/tauri';

/**
 * Un candidato restituito dalla ricerca di un titolo. Dice quale **simbolo** usare con quale
 * **provider**, così l'utente sceglie la fonte con cognizione (e si compila `providerSymbols`).
 */
export interface SymbolMatch {
  provider: QuoteProviderId; // 'yahoo' | 'finnhub' | (in futuro altri)
  symbol: string; // simbolo per quel provider, es. 'FLOW.AS' (Yahoo), 'LBTYA' (Finnhub)
  name: string;
  exchange?: string;
  currency?: string;
  assetType: AssetType;
}

// --- parser PURI (testabili senza rete) -------------------------------------

interface YahooSearchResponse {
  quotes?: Array<{
    symbol?: string;
    shortname?: string;
    longname?: string;
    exchange?: string;
    quoteType?: string;
  }>;
}

function yahooAssetType(quoteType: string | undefined): AssetType {
  switch ((quoteType ?? '').toUpperCase()) {
    case 'EQUITY':
      return 'equity';
    case 'ETF':
      return 'etf';
    case 'CRYPTOCURRENCY':
      return 'crypto';
    default:
      return 'other';
  }
}

/** Estrae i candidati azionari/ETF dalla risposta dell'endpoint search di Yahoo. */
export function parseYahooSearch(data: YahooSearchResponse): SymbolMatch[] {
  const out: SymbolMatch[] = [];
  for (const q of data?.quotes ?? []) {
    if (!q.symbol) continue;
    const assetType = yahooAssetType(q.quoteType);
    if (assetType !== 'equity' && assetType !== 'etf') continue; // i provider quotano equity/ETF
    out.push({
      provider: 'yahoo',
      symbol: q.symbol,
      name: q.longname || q.shortname || q.symbol,
      exchange: q.exchange,
      assetType,
    });
  }
  return out;
}

interface FinnhubSearchResponse {
  result?: Array<{ symbol?: string; description?: string; displaySymbol?: string; type?: string }>;
}

/** Estrae i candidati dalla risposta dell'endpoint search di Finnhub (azioni/ETF, mercati USA free). */
export function parseFinnhubSearch(data: FinnhubSearchResponse): SymbolMatch[] {
  const out: SymbolMatch[] = [];
  for (const r of data?.result ?? []) {
    if (!r.symbol) continue;
    const assetType: AssetType = /ETF|ETP/i.test(r.type ?? '') ? 'etf' : 'equity';
    out.push({
      provider: 'finnhub',
      symbol: r.symbol,
      name: r.description || r.displaySymbol || r.symbol,
      assetType,
    });
  }
  return out;
}

/** Deduplica per `provider:symbol` mantenendo l'ordine (Yahoo prima) e limita i risultati. */
export function mergeMatches(lists: SymbolMatch[][], limit = 12): SymbolMatch[] {
  const seen = new Set<string>();
  const out: SymbolMatch[] = [];
  for (const m of lists.flat()) {
    const key = `${m.provider}:${m.symbol}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out.slice(0, limit);
}

// --- servizio ----------------------------------------------------------------

/**
 * Ricerca di un titolo su più provider, per aiutare a scegliere fonte + simbolo giusti.
 * - **Yahoo** (`/v1/finance/search`): copertura globale, ma **solo nell'app nativa Tauri** (CORS).
 * - **Finnhub** (`/search`): funziona anche da browser (CORS ok), mercati USA del free tier.
 * - **Alpha Vantage** è volutamente escluso: il suo SYMBOL_SEARCH consuma la quota giornaliera (25).
 *
 * Nel browser di sviluppo si vedono quindi soprattutto i risultati Finnhub; la ricerca completa
 * (Yahoo) è disponibile nell'app desktop/Android.
 */
@Injectable({ providedIn: 'root' })
export class SymbolSearchService {
  /** true se la ricerca completa (Yahoo) è disponibile su questa piattaforma. */
  get fullSearchAvailable(): boolean {
    return isTauri();
  }

  async search(query: string): Promise<SymbolMatch[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const tasks: Promise<SymbolMatch[]>[] = [];
    if (isTauri()) tasks.push(this.searchYahoo(q)); // globale, solo app nativa
    if (environment.finnhubApiKey) tasks.push(this.searchFinnhub(q));
    const lists = await Promise.all(tasks.map((t) => t.catch(() => [] as SymbolMatch[])));
    return mergeMatches(lists);
  }

  private async searchYahoo(q: string): Promise<SymbolMatch[]> {
    const url =
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}` +
      `&quotesCount=10&newsCount=0`;
    const res = await platformFetch(url);
    if (!res.ok) return [];
    return parseYahooSearch((await res.json()) as YahooSearchResponse);
  }

  private async searchFinnhub(q: string): Promise<SymbolMatch[]> {
    const url =
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}` +
      `&token=${environment.finnhubApiKey}`;
    const res = await platformFetch(url);
    if (!res.ok) return [];
    return parseFinnhubSearch((await res.json()) as FinnhubSearchResponse);
  }
}
