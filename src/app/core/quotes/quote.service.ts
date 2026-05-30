import { inject, Injectable } from '@angular/core';
import { InstrumentsRepository } from '../data';
import { Instrument } from '../models';
import { AlphaVantageProvider } from './alphavantage.provider';
import { FinnhubProvider } from './finnhub.provider';
import { FxProvider } from './fx.provider';
import { QuoteProvider } from './quote-provider';

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
  ];

  providerFor(instrument: Instrument): QuoteProvider | undefined {
    return this.providers.find((p) => p.supports(instrument));
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
    let updated = 0;
    const failed: string[] = [];

    for (const inst of instruments) {
      const provider = this.providerFor(inst);
      if (!provider) continue; // manuali / non supportati: lasciati intatti
      try {
        const q = await provider.getQuote(inst);
        if (!q || q.price <= 0) {
          failed.push(inst.symbol);
          continue;
        }
        const cur = (inst.currency || 'EUR').toUpperCase();
        let rate = rates.get(cur);
        if (rate === undefined) {
          rate = (await this.fx.getRate(cur, 'EUR')) ?? 1;
          rates.set(cur, rate);
        }
        await this.instrumentsRepo.upsert({
          ...inst,
          lastPrice: q.price * rate, // in EUR
          prevClose: q.prevClose != null ? q.prevClose * rate : inst.prevClose,
          lastPriceAt: q.at,
        });
        updated++;
      } catch {
        failed.push(inst.symbol);
      }
    }
    return { updated, failed, at: new Date() };
  }
}
