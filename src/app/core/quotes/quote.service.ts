import { inject, Injectable } from '@angular/core';
import { InstrumentsRepository } from '../data';
import { Instrument } from '../models';
import { AlphaVantageProvider } from './alphavantage.provider';
import { FinnhubProvider } from './finnhub.provider';
import { FxProvider } from './fx.provider';
import { Quote } from './quote';
import { QuoteProvider } from './quote-provider';
import { YahooProvider } from './yahoo.provider';

export interface RefreshResult {
  updated: number;
  failed: string[];
  at: Date;
}

/**
 * Orchestratore delle quotazioni. Nessuno streaming (vincolo di progetto): refresh
 * all'avvio se "stale" e su pulsante manuale, con cache in Firestore. I prezzi vengono
 * SEMPRE convertiti in EUR (valuta base) al cambio corrente, così il valore è coerente
 * col costo di carico (anch'esso in EUR). I simboli non risolti non vengono sovrascritti.
 */
@Injectable({ providedIn: 'root' })
export class QuoteService {
  private readonly instrumentsRepo = inject(InstrumentsRepository);
  private readonly fx = inject(FxProvider);
  private readonly providers: QuoteProvider[] = [
    inject(FinnhubProvider),
    inject(AlphaVantageProvider),
    inject(YahooProvider), // solo app nativa Tauri (CORS): nel browser supports() è false
  ];

  /**
   * Ordine dei fallback (il provider primario dello strumento va comunque per primo): Yahoo nativo,
   * poi Finnhub, infine Alpha Vantage che ha la quota più stretta (25/giorno) → usato per ultimo.
   */
  private static readonly FALLBACK_RANK: Record<string, number> = {
    yahoo: 0,
    finnhub: 1,
    alphavantage: 2,
  };

  /**
   * Provider che sanno quotare lo strumento, in ordine di tentativo: prima il provider "primario"
   * (`instrument.provider`), poi gli altri in ordine quota-friendly. Abilita la catena con fallback.
   */
  providersFor(instrument: Instrument): QuoteProvider[] {
    const rank = (p: QuoteProvider): number =>
      p.id === instrument.provider ? -1 : (QuoteService.FALLBACK_RANK[p.id] ?? 9);
    return this.providers.filter((p) => p.supports(instrument)).sort((a, b) => rank(a) - rank(b));
  }

  isStale(
    lastPriceAt: Date | undefined,
    stalenessMinutes: number,
    now: Date = new Date(),
  ): boolean {
    if (!lastPriceAt) return true;
    return (now.getTime() - lastPriceAt.getTime()) / 60_000 >= stalenessMinutes;
  }

  async refreshAll(): Promise<RefreshResult> {
    const instruments = await this.instrumentsRepo.list();
    const rates = new Map<string, number>([['EUR', 1]]); // valuta → tasso verso EUR (cache per refresh)
    const lastCallAt = new Map<string, number>(); // providerId → timestamp ultima chiamata
    let updated = 0;
    const failed: string[] = [];

    const rateToEur = async (currency: string | undefined): Promise<number> => {
      const cur = (currency || 'EUR').toUpperCase();
      let rate = rates.get(cur);
      if (rate === undefined) {
        rate = (await this.fx.getRate(cur, 'EUR')) ?? 1;
        rates.set(cur, rate);
      }
      return rate;
    };

    for (const inst of instruments) {
      const providers = this.providersFor(inst);
      if (providers.length === 0) continue; // manuali / non configurati: lasciati intatti

      let quoted = false;
      for (const provider of providers) {
        let q: Quote | null = null;
        try {
          // Rispetta il limite di burst del provider (es. Alpha Vantage: 1 req/secondo):
          // distanzia le chiamate consecutive allo stesso provider.
          const minInterval = provider.minIntervalMs ?? 0;
          if (minInterval > 0) {
            const wait = minInterval - (Date.now() - (lastCallAt.get(provider.id) ?? 0));
            if (wait > 0) await new Promise((r) => setTimeout(r, wait));
          }
          lastCallAt.set(provider.id, Date.now());
          q = await provider.getQuote(inst);
        } catch {
          q = null; // questo provider ha fallito: proseguo con il prossimo della catena
        }
        if (!q || q.price <= 0) continue;

        // Conversione in EUR con la valuta restituita DALLA QUOTAZIONE (q.currency): Yahoo risponde
        // nella valuta nativa del mercato (es. HKD per 0001.HK, CHF per TIBN.SW), che può differire
        // da inst.currency. Così il valore in EUR è corretto a prescindere dal provider usato.
        const rate = await rateToEur(q.currency ?? inst.currency);
        await this.instrumentsRepo.upsert({
          ...inst,
          lastPrice: q.price * rate, // in EUR
          prevClose: q.prevClose != null ? q.prevClose * rate : inst.prevClose,
          lastPriceAt: q.at,
        });
        updated++;
        quoted = true;
        break; // quotato: stop alla catena
      }
      if (!quoted) failed.push(inst.symbol); // nessun provider della catena ha risposto
    }
    return { updated, failed, at: new Date() };
  }
}
