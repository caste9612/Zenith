import { mergeMatches, parseFinnhubSearch, parseYahooSearch, SymbolMatch } from './symbol-search';

describe('parseYahooSearch', () => {
  it('tiene solo azioni/ETF e ne estrae simbolo, nome, borsa', () => {
    const r = parseYahooSearch({
      quotes: [
        { symbol: 'FLOW.AS', longname: 'Flow Traders', exchange: 'AMS', quoteType: 'EQUITY' },
        { symbol: 'PHO', shortname: 'Invesco Water', exchange: 'NGM', quoteType: 'ETF' },
        { symbol: 'DOT-USD', shortname: 'Polkadot', quoteType: 'CRYPTOCURRENCY' }, // scartato
        { symbol: 'X', quoteType: 'OPTION' }, // scartato
        { shortname: 'senza simbolo' }, // scartato
      ],
    });
    expect(r.map((m) => m.symbol)).toEqual(['FLOW.AS', 'PHO']);
    expect(r[0]).toEqual({
      provider: 'yahoo',
      symbol: 'FLOW.AS',
      name: 'Flow Traders',
      exchange: 'AMS',
      assetType: 'equity',
    });
    expect(r[1].assetType).toBe('etf');
  });

  it('ripiega su shortname/symbol per il nome; risposta vuota → []', () => {
    expect(parseYahooSearch({ quotes: [{ symbol: 'AAA', quoteType: 'EQUITY' }] })[0].name).toBe(
      'AAA',
    );
    expect(parseYahooSearch({})).toEqual([]);
  });
});

describe('parseFinnhubSearch', () => {
  it('mappa ETF/ETP su etf, il resto su equity', () => {
    const r = parseFinnhubSearch({
      result: [
        { symbol: 'LBTYA', description: 'Liberty Global', type: 'Common Stock' },
        { symbol: 'SPY', description: 'SPDR S&P 500', type: 'ETF' },
        { description: 'senza simbolo', type: 'Common Stock' }, // scartato
      ],
    });
    expect(r).toEqual([
      { provider: 'finnhub', symbol: 'LBTYA', name: 'Liberty Global', assetType: 'equity' },
      { provider: 'finnhub', symbol: 'SPY', name: 'SPDR S&P 500', assetType: 'etf' },
    ]);
  });

  it('risposta senza result → []', () => {
    expect(parseFinnhubSearch({})).toEqual([]);
  });
});

describe('mergeMatches', () => {
  const m = (provider: 'yahoo' | 'finnhub', symbol: string): SymbolMatch => ({
    provider,
    symbol,
    name: symbol,
    assetType: 'equity',
  });

  it('deduplica per provider:symbol mantenendo l’ordine', () => {
    const out = mergeMatches([
      [m('yahoo', 'FLOW.AS'), m('yahoo', 'FLOW.AS')],
      [m('finnhub', 'FLOW.AS')], // stesso simbolo ma altro provider → tenuto
    ]);
    expect(out.map((x) => `${x.provider}:${x.symbol}`)).toEqual([
      'yahoo:FLOW.AS',
      'finnhub:FLOW.AS',
    ]);
  });

  it('rispetta il limite', () => {
    const many = Array.from({ length: 20 }, (_, i) => m('yahoo', 'S' + i));
    expect(mergeMatches([many], 5).length).toBe(5);
  });
});
