import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InstrumentsRepository } from '../data';
import { Instrument } from '../models';
import { AlphaVantageProvider } from './alphavantage.provider';
import { FinnhubProvider } from './finnhub.provider';
import { FxProvider } from './fx.provider';
import { Quote } from './quote';
import { QuoteService } from './quote.service';

/**
 * Svuota la coda dei microtask. jasmine.clock() finge setTimeout e Date, ma NON le Promise:
 * tra un tick e l'altro serve far avanzare le `await` interne di refreshAll a mano.
 */
const flushMicrotasks = async (turns = 50): Promise<void> => {
  for (let i = 0; i < turns; i++) await Promise.resolve();
};

class FakeInstruments {
  items: Instrument[] = [];
  list = async (): Promise<Instrument[]> => this.items.map((i) => ({ ...i }));
  upsert = async (i: Instrument): Promise<string> => {
    const id = (i.id ?? i.symbol)!;
    const idx = this.items.findIndex((x) => (x.id ?? x.symbol) === id);
    if (idx >= 0) this.items[idx] = { ...i, id };
    else this.items.push({ ...i, id });
    return id;
  };
}

describe('QuoteService', () => {
  let service: QuoteService;
  let repo: FakeInstruments;
  let quotes: Record<string, Quote | null>;
  let usdToEur: number;
  let avCallTimes: number[]; // istanti (ms) delle chiamate ad Alpha Vantage, per il rate limit

  const finnhub = {
    id: 'finnhub',
    supports: (i: Instrument) => i.provider === 'finnhub',
    getQuote: async (i: Instrument) => quotes[i.symbol] ?? null,
  };
  const alphavantage = {
    id: 'alphavantage',
    minIntervalMs: 0,
    supports: (i: Instrument) => i.provider === 'alphavantage',
    getQuote: async (i: Instrument) => {
      avCallTimes.push(Date.now());
      return quotes[i.symbol] ?? null;
    },
  };
  const fx = { getRate: async (from: string, to: string) => (from === to ? 1 : usdToEur) };

  const inst = (p: Partial<Instrument> & { symbol: string }): Instrument => ({
    name: p.symbol,
    assetType: 'equity',
    currency: 'EUR',
    provider: 'finnhub',
    ...p,
  });

  beforeEach(() => {
    repo = new FakeInstruments();
    quotes = {};
    usdToEur = 0.5;
    avCallTimes = [];
    alphavantage.minIntervalMs = 0;
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        QuoteService,
        { provide: InstrumentsRepository, useValue: repo },
        { provide: FinnhubProvider, useValue: finnhub },
        { provide: AlphaVantageProvider, useValue: alphavantage },
        { provide: FxProvider, useValue: fx },
      ],
    });
    service = TestBed.inject(QuoteService);
  });

  describe('isStale', () => {
    const now = new Date(Date.UTC(2024, 0, 10, 12, 0, 0));
    const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);

    it('è stale se non c’è mai stato un aggiornamento', () => {
      expect(service.isStale(undefined, 720, now)).toBe(true);
    });
    it('non è stale sotto la soglia', () => {
      expect(service.isStale(minsAgo(60), 720, now)).toBe(false);
    });
    it('è stale oltre la soglia', () => {
      expect(service.isStale(minsAgo(800), 720, now)).toBe(true);
    });
    it('confine esatto: alla soglia è stale (≥)', () => {
      expect(service.isStale(minsAgo(720), 720, now)).toBe(true);
    });
  });

  describe('refreshAll', () => {
    it('converte la quotazione in EUR al cambio corrente', async () => {
      repo.items = [inst({ symbol: 'US', currency: 'USD', lastPrice: 0 })];
      quotes['US'] = { symbol: 'US', price: 10, prevClose: 8, currency: 'USD', at: new Date() };
      const r = await service.refreshAll();
      const stored = repo.items.find((i) => i.symbol === 'US')!;
      expect(stored.lastPrice).toBeCloseTo(5, 10); // 10 × 0,5
      expect(stored.prevClose).toBeCloseTo(4, 10); // 8 × 0,5
      expect(r.updated).toBe(1);
      expect(r.failed).toEqual([]);
    });

    it('strumento in EUR: nessuna conversione (cambio 1)', async () => {
      repo.items = [inst({ symbol: 'EU', currency: 'EUR' })];
      quotes['EU'] = { symbol: 'EU', price: 12, currency: 'EUR', at: new Date() };
      await service.refreshAll();
      expect(repo.items.find((i) => i.symbol === 'EU')!.lastPrice).toBe(12);
    });

    it('simbolo non risolto: finisce in failed e NON sovrascrive il prezzo', async () => {
      repo.items = [inst({ symbol: 'X', currency: 'EUR', lastPrice: 99 })];
      quotes['X'] = null; // provider non restituisce quotazione
      const r = await service.refreshAll();
      expect(r.failed).toContain('X');
      expect(r.updated).toBe(0);
      expect(repo.items.find((i) => i.symbol === 'X')!.lastPrice).toBe(99); // intatto
    });

    it('strumenti manuali: non toccati (nessun provider) e non tra i failed', async () => {
      repo.items = [inst({ symbol: 'BTP', provider: 'manual', lastPrice: 101 })];
      const r = await service.refreshAll();
      expect(r.updated).toBe(0);
      expect(r.failed).toEqual([]);
      expect(repo.items.find((i) => i.symbol === 'BTP')!.lastPrice).toBe(101);
    });

    it('seleziona il provider giusto per strumento (Finnhub vs Alpha Vantage)', async () => {
      repo.items = [
        inst({ symbol: 'US', provider: 'finnhub', currency: 'EUR' }),
        inst({ symbol: 'EU', provider: 'alphavantage', currency: 'EUR' }),
      ];
      quotes['US'] = { symbol: 'US', price: 1, currency: 'EUR', at: new Date() };
      quotes['EU'] = { symbol: 'EU', price: 2, currency: 'EUR', at: new Date() };
      const r = await service.refreshAll();
      expect(r.updated).toBe(2);
      expect(repo.items.find((i) => i.symbol === 'US')!.lastPrice).toBe(1);
      expect(repo.items.find((i) => i.symbol === 'EU')!.lastPrice).toBe(2);
    });

    it('distanzia le chiamate consecutive allo stesso provider (minIntervalMs, timer finti)', async () => {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(Date.UTC(2024, 0, 1)));
      try {
        const INTERVAL = 1000;
        alphavantage.minIntervalMs = INTERVAL;
        repo.items = [
          inst({ symbol: 'A1', provider: 'alphavantage', currency: 'EUR' }),
          inst({ symbol: 'A2', provider: 'alphavantage', currency: 'EUR' }),
        ];
        quotes['A1'] = { symbol: 'A1', price: 1, currency: 'EUR', at: new Date() };
        quotes['A2'] = { symbol: 'A2', price: 2, currency: 'EUR', at: new Date() };

        // setTimeout è finto: dopo la PRIMA chiamata, refreshAll resta in attesa del minIntervalMs.
        const done = service.refreshAll();
        await flushMicrotasks();
        expect(avCallTimes.length).toBe(1); // la seconda non è ancora partita

        jasmine.clock().tick(INTERVAL); // sblocca l'attesa
        await flushMicrotasks();
        const r = await done;

        expect(avCallTimes.length).toBe(2);
        // con i timer finti la distanza è ESATTA (niente slack come col timer reale)
        expect(avCallTimes[1] - avCallTimes[0]).toBe(INTERVAL);
        expect(r.updated).toBe(2);
      } finally {
        jasmine.clock().uninstall();
      }
    });
  });
});
