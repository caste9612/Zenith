import { Instrument } from '../models';
import { symbolForProvider } from './quote-provider';

const inst = (p: Partial<Instrument> & { symbol: string }): Instrument => ({
  name: p.symbol,
  assetType: 'equity',
  currency: 'EUR',
  provider: 'finnhub',
  ...p,
});

describe('symbolForProvider', () => {
  it('legacy: usa `symbol` per il provider primario dello strumento', () => {
    const i = inst({ symbol: 'LBTYA', provider: 'finnhub' });
    expect(symbolForProvider(i, 'finnhub')).toBe('LBTYA');
  });

  it('legacy: undefined per un provider diverso dal primario (nessun fallback indebito)', () => {
    const i = inst({ symbol: 'LBTYA', provider: 'finnhub' });
    expect(symbolForProvider(i, 'yahoo')).toBeUndefined();
    expect(symbolForProvider(i, 'alphavantage')).toBeUndefined();
  });

  it('mappa providerSymbols: ogni provider elencato è quotabile (abilita la catena)', () => {
    const i = inst({
      symbol: 'FLOW',
      provider: 'alphavantage',
      providerSymbols: { yahoo: 'FLOW.AS', alphavantage: 'FLOW.AMS' },
    });
    expect(symbolForProvider(i, 'yahoo')).toBe('FLOW.AS');
    expect(symbolForProvider(i, 'alphavantage')).toBe('FLOW.AMS');
    // Finnhub non è in mappa e non è il primario → non quotabile da Finnhub
    expect(symbolForProvider(i, 'finnhub')).toBeUndefined();
  });

  it('la mappa ha precedenza sul `symbol` anche per il provider primario', () => {
    const i = inst({ symbol: 'FLOW', provider: 'yahoo', providerSymbols: { yahoo: 'FLOW.AS' } });
    expect(symbolForProvider(i, 'yahoo')).toBe('FLOW.AS');
  });

  it('valore vuoto/spazi in mappa → trattato come assente', () => {
    // ripiega sul `symbol` se il provider è il primario…
    const i = inst({ symbol: 'X', provider: 'finnhub', providerSymbols: { finnhub: '  ' } });
    expect(symbolForProvider(i, 'finnhub')).toBe('X');
    // …altrimenti resta non quotabile da quel provider
    const j = inst({ symbol: 'Y', provider: 'finnhub', providerSymbols: { yahoo: '' } });
    expect(symbolForProvider(j, 'yahoo')).toBeUndefined();
  });

  it('applica il trim al simbolo mappato', () => {
    const i = inst({ symbol: 'X', provider: 'manual', providerSymbols: { yahoo: ' 0001.HK ' } });
    expect(symbolForProvider(i, 'yahoo')).toBe('0001.HK');
  });
});
