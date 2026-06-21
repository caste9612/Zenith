import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HoldingsRepository, InstrumentsRepository, TransactionsRepository } from '../data';
import { Holding, Instrument, Transaction } from '../models';
import { PortfolioService } from './portfolio.service';

/** Repository finto in memoria: implementa solo i metodi usati da PortfolioService. */
class FakeRepo<T extends { id?: string }> {
  items: T[] = [];
  private seq = 0;
  list = async (): Promise<T[]> => this.items.map((i) => ({ ...i }));
  upsert = async (item: T): Promise<string> => {
    const id = item.id ?? `gen-${++this.seq}`;
    const stored = { ...item, id } as T;
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx >= 0) this.items[idx] = stored;
    else this.items.push(stored);
    return id;
  };
  remove = async (id: string): Promise<void> => {
    this.items = this.items.filter((i) => i.id !== id);
  };
}

describe('PortfolioService · PMC e P&L (metodo del costo medio)', () => {
  let service: PortfolioService;
  let holdings: FakeRepo<Holding>;
  let instruments: FakeRepo<Instrument>;
  let txs: FakeRepo<Transaction>;

  const d = (day: number) => new Date(Date.UTC(2024, 0, day));
  const holdingFor = (sym: string) => holdings.items.find((h) => h.instrumentId === sym);

  beforeEach(() => {
    holdings = new FakeRepo<Holding>();
    instruments = new FakeRepo<Instrument>();
    txs = new FakeRepo<Transaction>();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        PortfolioService,
        { provide: HoldingsRepository, useValue: holdings },
        { provide: InstrumentsRepository, useValue: instruments },
        { provide: TransactionsRepository, useValue: txs },
      ],
    });
    service = TestBed.inject(PortfolioService);
  });

  it('un acquisto crea la posizione con PMC = importo / quantità', async () => {
    await service.addBuy({ symbol: 'AAA', date: d(1), quantity: 10, amount: 1000 });
    const h = holdingFor('AAA')!;
    expect(h.quantity).toBe(10);
    expect(h.avgCost).toBe(100);
  });

  it('più acquisti → PMC medio ponderato (commissioni incluse nell’importo)', async () => {
    await service.addBuy({ symbol: 'AAA', date: d(1), quantity: 10, amount: 1000 }); // 100
    await service.addBuy({ symbol: 'AAA', date: d(2), quantity: 10, amount: 1400 }); // 140
    const h = holdingFor('AAA')!;
    expect(h.quantity).toBe(20);
    expect(h.avgCost).toBe(120); // (1000 + 1400) / 20
  });

  it('vendita parziale: riduce la quantità, NON cambia il PMC', async () => {
    await service.addBuy({ symbol: 'AAA', date: d(1), quantity: 20, amount: 2400 }); // PMC 120
    await service.addSell({ symbol: 'AAA', date: d(2), quantity: 5, amount: 700 });
    const h = holdingFor('AAA')!;
    expect(h.quantity).toBe(15);
    expect(h.avgCost).toBe(120); // invariato dalla vendita
  });

  it('vendita totale: quantità a 0 → la posizione viene rimossa', async () => {
    await service.addBuy({ symbol: 'AAA', date: d(1), quantity: 10, amount: 1000 });
    await service.addSell({ symbol: 'AAA', date: d(2), quantity: 10, amount: 1300 });
    expect(holdingFor('AAA')).toBeUndefined();
    expect(holdings.items.length).toBe(0);
  });

  it('i dividendi non toccano quantità/PMC e restano come movimento', async () => {
    await service.addBuy({ symbol: 'AAA', date: d(1), quantity: 10, amount: 1000 });
    await service.addDividend({ symbol: 'AAA', date: d(2), amount: 50 });
    const h = holdingFor('AAA')!;
    expect(h.quantity).toBe(10);
    expect(h.avgCost).toBe(100);
    const divs = txs.items.filter((t) => t.type === 'dividend');
    expect(divs.length).toBe(1);
    expect(divs[0].amount).toBe(50);
  });

  it('deleteTransaction ricalcola la posizione dai movimenti rimasti', async () => {
    await service.addBuy({ symbol: 'AAA', date: d(1), quantity: 10, amount: 1000 }); // 100
    await service.addBuy({ symbol: 'AAA', date: d(2), quantity: 10, amount: 2000 }); // → PMC 150
    const second = txs.items.find((t) => t.amount === 2000)!;
    await service.deleteTransaction(second);
    const h = holdingFor('AAA')!;
    expect(h.quantity).toBe(10);
    expect(h.avgCost).toBe(100); // tornato al solo primo acquisto
  });

  it('currentValueEur: quantità × prezzo (lastPrice, poi manuale, poi PMC)', async () => {
    await service.addBuy({ symbol: 'AAA', date: d(1), quantity: 10, amount: 1000 }); // PMC 100
    // nessuna quotazione → fallback al costo medio
    expect(await service.currentValueEur()).toBe(1000);
    // con lastPrice → usa quello
    const ins = instruments.items.find((i) => i.symbol === 'AAA')!;
    await instruments.upsert({ ...ins, lastPrice: 120 });
    expect(await service.currentValueEur()).toBe(1200);
  });

  it('ensureInstrument non duplica lo strumento tra più acquisti', async () => {
    await service.addBuy({ symbol: 'aaa', date: d(1), quantity: 1, amount: 10 });
    await service.addBuy({ symbol: 'AAA', date: d(2), quantity: 1, amount: 10 });
    expect(instruments.items.length).toBe(1); // simbolo normalizzato in maiuscolo
    expect(instruments.items[0].id).toBe('AAA');
  });

  it('addBuy su strumento con id≠symbol: aggrega, non duplica (regressione ACOMO/ACOMO.AMS)', async () => {
    // strumento importato: id "ACOMO" ma symbol "ACOMO.AMS", con posizione di apertura
    await instruments.upsert({
      id: 'ACOMO',
      symbol: 'ACOMO.AMS',
      name: 'ACOMO',
      assetType: 'equity',
      currency: 'EUR',
      provider: 'alphavantage',
    });
    await txs.upsert({
      id: 'open-ACOMO',
      date: d(1),
      type: 'buy',
      accountId: 'azionario',
      instrumentId: 'ACOMO',
      quantity: 100,
      amount: 2400,
      currency: 'EUR',
    });
    await service.recompute('ACOMO');
    expect(holdingFor('ACOMO')!.quantity).toBe(100);

    // il portafoglio linka l'operazione col SYMBOL ("ACOMO.AMS")
    await service.addBuy({ symbol: 'ACOMO.AMS', date: d(2), quantity: 100, amount: 2330 });

    expect(instruments.items.length).toBe(1); // nessun duplicato
    expect(holdingFor('ACOMO.AMS')).toBeUndefined();
    const h = holdingFor('ACOMO')!;
    expect(h.quantity).toBe(200); // aggregato
    expect(h.avgCost).toBe(23.65); // (2400 + 2330) / 200
  });

  it('caso limite: vendita superiore al posseduto si limita al disponibile (nessun errore)', async () => {
    await service.addBuy({ symbol: 'AAA', date: d(1), quantity: 10, amount: 1000 });
    await service.addSell({ symbol: 'AAA', date: d(2), quantity: 999, amount: 50000 });
    expect(holdingFor('AAA')).toBeUndefined(); // quantità clampata a 0 → posizione rimossa
  });
});
