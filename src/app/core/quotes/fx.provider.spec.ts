import { FxProvider } from './fx.provider';

/** Risposta HTTP finta (il browser di test ha `Response`). */
function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// FxProvider non ha dipendenze iniettate: si istanzia direttamente. platformFetch fuori da
// Tauri usa il `fetch` globale del browser → si fa lo spy su window.fetch.
describe('FxProvider · getRate', () => {
  let fx: FxProvider;

  beforeEach(() => {
    fx = new FxProvider();
  });

  it('stessa valuta → 1, senza chiamate di rete', async () => {
    const spy = spyOn(window, 'fetch');
    expect(await fx.getRate('EUR', 'EUR')).toBe(1);
    expect(await fx.getRate('usd', 'USD')).toBe(1); // normalizza maiuscole
    expect(spy).not.toHaveBeenCalled();
  });

  it('usa Frankfurter come fonte primaria', async () => {
    const spy = spyOn(window, 'fetch').and.resolveTo(jsonResponse({ rates: { EUR: 0.9 } }));
    expect(await fx.getRate('USD', 'EUR')).toBe(0.9);
    expect(String(spy.calls.first().args[0])).toContain('frankfurter.dev');
  });

  it('fallback su open.er-api se Frankfurter non risponde (status non ok)', async () => {
    const spy = spyOn(window, 'fetch').and.callFake(async (url: RequestInfo | URL) => {
      return String(url).includes('frankfurter')
        ? jsonResponse({}, 500)
        : jsonResponse({ rates: { EUR: 0.92 } });
    });
    expect(await fx.getRate('USD', 'EUR')).toBe(0.92);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(String(spy.calls.mostRecent().args[0])).toContain('open.er-api.com');
  });

  it('Frankfurter senza tasso valido → fallback', async () => {
    spyOn(window, 'fetch').and.callFake(async (url: RequestInfo | URL) =>
      String(url).includes('frankfurter')
        ? jsonResponse({ rates: {} })
        : jsonResponse({ rates: { EUR: 0.95 } }),
    );
    expect(await fx.getRate('USD', 'EUR')).toBe(0.95);
  });

  it('nessuna fonte disponibile → null', async () => {
    spyOn(window, 'fetch').and.resolveTo(jsonResponse({}, 500));
    expect(await fx.getRate('USD', 'EUR')).toBeNull();
  });

  it('errore di rete su entrambe le fonti → null', async () => {
    spyOn(window, 'fetch').and.rejectWith(new Error('network'));
    expect(await fx.getRate('GBP', 'EUR')).toBeNull();
  });
});
