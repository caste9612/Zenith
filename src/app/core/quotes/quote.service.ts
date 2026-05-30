import { inject, Injectable } from '@angular/core';
import { InstrumentsRepository } from '../data';
import { Instrument } from '../models';
import { FinnhubProvider } from './finnhub.provider';
import { QuoteProvider } from './quote-provider';

export interface RefreshResult {
  updated: number;
  failed: string[];
  at: Date;
}

/**
 * Orchestratore delle quotazioni. Nessuno streaming (vincolo di progetto): refresh
 * all'avvio se "stale" e su pulsante manuale, con cache in Firestore (lastPrice/prevClose/
 * lastPriceAt). Strategy pattern: i provider sanno quotare i propri strumenti.
 */
@Injectable({ providedIn: 'root' })
export class QuoteService {
  private readonly instrumentsRepo = inject(InstrumentsRepository);
  private readonly providers: QuoteProvider[] = [inject(FinnhubProvider)];

  /** Provider in grado di quotare lo strumento, se esiste. */
  providerFor(instrument: Instrument): QuoteProvider | undefined {
    return this.providers.find((p) => p.supports(instrument));
  }

  /** true se una quota in cache va riaggiornata: assente o più vecchia della soglia. */
  isStale(
    lastPriceAt: Date | undefined,
    stalenessMinutes: number,
    now: Date = new Date(),
  ): boolean {
    if (!lastPriceAt) return true;
    return (now.getTime() - lastPriceAt.getTime()) / 60_000 >= stalenessMinutes;
  }

  /**
   * Aggiorna le quotazioni di tutti gli strumenti supportati. I simboli non risolti
   * (es. titoli europei sul free tier) NON vengono sovrascritti: restano all'ultimo
   * prezzo noto / manuale.
   */
  async refreshAll(): Promise<RefreshResult> {
    const instruments = await this.instrumentsRepo.list();
    let updated = 0;
    const failed: string[] = [];
    for (const inst of instruments) {
      const provider = this.providerFor(inst);
      if (!provider) continue;
      try {
        const q = await provider.getQuote(inst);
        if (q && q.price > 0) {
          await this.instrumentsRepo.upsert({
            ...inst,
            lastPrice: q.price,
            prevClose: q.prevClose ?? inst.prevClose,
            lastPriceAt: q.at,
          });
          updated++;
        } else {
          failed.push(inst.symbol);
        }
      } catch {
        failed.push(inst.symbol);
      }
    }
    return { updated, failed, at: new Date() };
  }
}
