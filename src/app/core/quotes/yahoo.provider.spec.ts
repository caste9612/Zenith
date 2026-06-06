import { Instrument } from '../models';
import { parseYahooQuote, YahooChartResponse, YahooMeta, YahooProvider } from './yahoo.provider';

const inst = (p: Partial<Instrument> & { symbol: string }): Instrument => ({
  name: p.symbol,
  assetType: 'equity',
  currency: 'EUR',
  provider: 'yahoo',
  ...p,
});

/** Risposta chart di Yahoo con i soli campi che leggiamo. */
const chart = (meta: YahooMeta | null): YahooChartResponse => ({
  chart: { result: meta === null ? null : [{ meta }], error: null },
});

describe('parseYahooQuote', () => {
  it('estrae prezzo, chiusura precedente e valuta dalla risposta', () => {
    const q = parseYahooQuote(
      chart({ regularMarketPrice: 12.5, chartPreviousClose: 12, currency: 'USD' }),
      inst({ symbol: 'TIBN', currency: 'EUR' }),
    );
    expect(q).not.toBeNull();
    expect(q!.price).toBe(12.5);
    expect(q!.prevClose).toBe(12);
    expect(q!.currency).toBe('USD'); // la valuta nativa di Yahoo prevale su quella dello strumento
    expect(q!.symbol).toBe('TIBN');
  });

  it('usa previousClose se chartPreviousClose manca; valuta di fallback dallo strumento', () => {
    const q = parseYahooQuote(
      chart({ regularMarketPrice: 8, previousClose: 7.5 }),
      inst({ symbol: 'X', currency: 'GBP' }),
    );
    expect(q!.prevClose).toBe(7.5);
    expect(q!.currency).toBe('GBP');
  });

  it('prevClose assente → undefined (non 0)', () => {
    const q = parseYahooQuote(chart({ regularMarketPrice: 10 }), inst({ symbol: 'X' }));
    expect(q!.price).toBe(10);
    expect(q!.prevClose).toBeUndefined();
  });

  it('risposta senza risultati o senza prezzo valido → null', () => {
    expect(parseYahooQuote(chart(null), inst({ symbol: 'X' }))).toBeNull();
    expect(parseYahooQuote(chart({}), inst({ symbol: 'X' }))).toBeNull();
    expect(parseYahooQuote(chart({ regularMarketPrice: 0 }), inst({ symbol: 'X' }))).toBeNull();
    expect(parseYahooQuote({}, inst({ symbol: 'X' }))).toBeNull();
  });
});

describe('YahooProvider.supports', () => {
  const provider = new YahooProvider();

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'];
  });

  it('nel browser (non Tauri) non supporta nulla: Yahoo è bloccato dalla CORS', () => {
    expect(provider.supports(inst({ symbol: 'X', provider: 'yahoo' }))).toBe(false);
  });

  it('dentro Tauri supporta i titoli azionari/ETF marcati yahoo', () => {
    (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] = {};
    expect(provider.supports(inst({ symbol: 'X', provider: 'yahoo', assetType: 'equity' }))).toBe(
      true,
    );
    expect(provider.supports(inst({ symbol: 'X', provider: 'yahoo', assetType: 'etf' }))).toBe(
      true,
    );
    // provider diverso o tipo non quotabile: no
    expect(provider.supports(inst({ symbol: 'X', provider: 'finnhub' }))).toBe(false);
    expect(provider.supports(inst({ symbol: 'X', provider: 'yahoo', assetType: 'bond' }))).toBe(
      false,
    );
  });
});
