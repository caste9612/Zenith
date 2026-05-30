import { Injectable, inject } from '@angular/core';
import { Instrument } from '../models';
import { FinnhubProvider } from './finnhub.provider';
import { QuoteProvider } from './quote-provider';

/**
 * Orchestratore delle quotazioni. In Fase 1 implementerà il refresh all'avvio e su
 * pulsante manuale, con cache in Firestore e logica di staleness (mai streaming).
 * Per ora espone la selezione del provider e la decisione di freschezza.
 */
@Injectable({ providedIn: 'root' })
export class QuoteService {
  private readonly providers: QuoteProvider[] = [inject(FinnhubProvider)];

  /** Provider in grado di quotare lo strumento, se esiste. */
  providerFor(instrument: Instrument): QuoteProvider | undefined {
    return this.providers.find((p) => p.supports(instrument));
  }

  /**
   * true se una quota in cache va riaggiornata: assente o più vecchia della soglia.
   * Funzione pura per essere facilmente testabile.
   */
  isStale(
    lastPriceAt: Date | undefined,
    stalenessMinutes: number,
    now: Date = new Date(),
  ): boolean {
    if (!lastPriceAt) return true;
    const ageMinutes = (now.getTime() - lastPriceAt.getTime()) / 60_000;
    return ageMinutes >= stalenessMinutes;
  }
}
