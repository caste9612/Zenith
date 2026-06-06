# 08 — Strategia di test e validazione

> Stato: **pianificato (TODO)**. Questo documento definisce *cosa* e *come* testare. L'implementazione
> della suite procede insieme allo sviluppo: **ogni nuova funzione di calcolo arriva con i suoi test**.

## Obiettivo
Validare la **logica finanziaria** (la parte dove un bug falsa i numeri in modo silenzioso) mentre si
sviluppa, usando i **dati reali dell'Excel come "oracolo"** — senza però versionarli, nel rispetto del
vincolo di progetto «dati finanziari fuori da git».

## Vincolo dati (importante)
- I valori **reali** (Excel, `data/seed.json`) **non entrano mai in git** (`*.xlsx`, `data/*.json` sono gitignorati).
- Le **fixture committate** usano numeri **sintetici ma realistici** (forma identica ai dati veri, importi inventati o scalati).
- Il confronto contro i **numeri reali** gira **solo in locale**, leggendo `data/seed.json`. Mai in CI pubblica.

## Due livelli di test
1. **Test unitari/logici** (committati, girano in CI) — fixture sintetiche, deterministici, niente rete né Firestore reale.
2. **Suite di validazione locale** (dati reali, gitignorati) — confronta gli aggregati calcolati dall'app con i **totali dell'Excel**; si esegue in locale prima del push quando cambiano import o logica di calcolo.

## Runner e setup
- **Karma + Jasmine** configurati (`ng test`, `tsconfig.spec.json`, `app.spec.ts`).
- **Headless attivo** ✅: `npm run test:ci` (= `config:gen` + `ng test --watch=false --browsers=ChromeHeadless`). Gira in locale e in **CI** (`.github/workflows/test.yml`, a ogni push su `main` e su PR). I service che usano `inject()` si testano con `TestBed` + `provideZonelessChangeDetection()` (l'app è zoneless) e **repository finti in memoria** (vedi `portfolio.service.spec.ts`).
- TODO setup ancora aperti:
  - helper comuni per il mock di `platformFetch` a livello di modulo (per testare i provider Finnhub/Alpha Vantage e l'FX direttamente);
  - factory di fixture sintetiche (`makeInstrument`, `makeTransaction`, `makeSnapshot`, …).
- (Valutazione futura, non ora) migrazione a Web Test Runner / Vitest se Karma dà attrito.

## Cosa testare, per modulo (checklist)

### `core/money/format.ts`
- [x] `formatEur` — interi, con decimali (`cents`), zero, negativi, separatori `it-IT`.
- [x] `formatSignedEur` — segno `+/−`, zero.
- [x] `formatPercent` — frazione → %, segno, arrotondamento.
- [x] `gainClass` — `gain` / `loss` / `flat` (confine a zero).

### `core/portfolio/portfolio.service.ts` (cuore della logica) — `portfolio.service.spec.ts`
- [x] `recompute` — **PMC** da più acquisti (costo medio ponderato).
- [x] acquisti successivi → aggiornamento corretto del PMC.
- [x] **vendita parziale** — riduce la quantità, **non** cambia il PMC.
- [x] **vendita totale** — quantità 0 → la posizione viene rimossa.
- [x] **dividendi** — non toccano quantità/PMC; restano come movimento.
- [x] `deleteTransaction` — ricalcolo coerente dopo l'eliminazione.
- [x] `currentValueEur` — quantità × prezzo (lastPrice → manuale → PMC).
- [x] casi limite — vendita > posseduto si limita al disponibile (nessun errore).

### `core/quotes/quote.service.ts` — `quote.service.spec.ts`
- [x] `isStale` — sotto/sopra soglia, confine esatto, `lastPriceAt` mancante.
- [x] `refreshAll` — conversione in **EUR** via FX, lista `failed`, **non** sovrascrive i simboli non risolti.
- [x] `minIntervalMs` — rate limit con **timer finti** (`jasmine.clock` + drain microtask): distanza esatta tra chiamate.
- [x] selezione provider (`providersFor`) e **catena con fallback**: il primario fallisce → prova il successivo; `failed` solo se falliscono **tutti**.
- [x] conversione con la **valuta della quotazione** (`q.currency`), non quella salvata sullo strumento.

### `core/quotes/quote-provider.ts` — `quote-provider.spec.ts`
- [x] `symbolForProvider` — simbolo per provider dalla mappa `providerSymbols`; ripiego su `symbol` solo per il provider primario; valori vuoti/spazi ignorati; trim. Abilita la catena multi-provider.

### `core/quotes/fx.provider.ts` — `fx.provider.spec.ts`
- [x] `getRate` — stessa valuta → `1`, parsing risposta **Frankfurter**, **fallback** `open.er-api`, errore → `null` (spy su `window.fetch`, usato da `platformFetch` fuori da Tauri).

### `core/quotes/yahoo.provider.ts` — `yahoo.provider.spec.ts`
- [x] `parseYahooQuote` (puro) — prezzo/`prevClose`/valuta dalla risposta `chart`; `previousClose` di fallback; `prevClose` assente → `undefined`; risposta senza risultati o prezzo ≤ 0 → `null`.
- [x] `supports` — gating su **Tauri**: nel browser sempre `false` (CORS); dentro Tauri vero per equity/ETF marcati `yahoo`, falso per provider/tipo diversi.

### `core/quotes/symbol-search.ts` — `symbol-search.spec.ts`
- [x] `parseYahooSearch` / `parseFinnhubSearch` (puri) — tengono solo azioni/ETF, mappano il tipo, ripiego sul nome; risposte vuote → `[]`.
- [x] `mergeMatches` — dedup per `provider:symbol` mantenendo l'ordine, rispetto del limite.

### Snapshot / patrimonio netto — `core/balance/net-worth.spec.ts`
- [x] `computeNetWorth` = somma asset − passività (`isLiability`).
- [x] aggregati `totalsByOwner` e `totalsByAssetClass` (con `assetsOnly` per la torta).
- [x] `valueReturns`/`seriesMetrics` (`core/portfolio/metrics`) — indicatori del **patrimonio netto** dalla serie del netto: variazioni periodo su periodo, salto dei passi con base ≤ 0, CAGR/volatilità/maxDrawdown coerenti con le primitive, serie corta → zero.
- [x] **serie storiche** `assetClassSeries`/`ownerSeries`/`accountSeries`/`savingRateSeries` — valori per classe/intestatario/voce/risparmio allineati ai mesi (0 dove la chiave manca; `null` nel risparmio).
- [ ] precompilazione del nuovo snapshot dai valori del mese precedente (logica nel componente).

### Componenti (shared)
- [x] `AllocationPieComponent` — percentuali, una fetta per voce > 0, esclusione ≤ 0, stato vuoto.
- [x] `ValueChartComponent` — con ≥ 2 punti disegna area+linea e mostra l'ultimo valore; < 2 punti → messaggio "dati insufficienti".
- [x] `StackedAreaChartComponent` — un'area per serie, legenda con i valori del mese e totale; < 2 mesi → messaggio.
- [x] `BarChartComponent` — una barra per valore presente (salta i `null`), percentuale del mese attivo; stato vuoto.

### Indicatori (Sharpe & co.) — `core/portfolio/metrics.spec.ts`
- [x] serie dei **rendimenti mensili** time-weighted dal track record (`monthlyReturns`: scorporo flussi, vendite, dividendi, salto base ≤ 0).
- [x] **Sharpe** (media/dev. std × annualizzazione, rf), **volatilità**, **max drawdown**, **CAGR**.
- [x] casi: serie di 1 punto, serie piatta (dev. std 0 → niente divisione per zero), valori noti calcolati a mano.
- [x] serie di **valori** (patrimonio netto): `valueReturns`/`seriesMetrics` — vedi sezione Snapshot.

### Benchmark (S&P / NASDAQ)
- [ ] flusso netto investito (acquisti − vendite) applicato all'indice → unità simulate, valore, confronto col portafoglio.

## Suite di validazione locale (oracolo = Excel) — ✅ implementata
`scripts/validate/oracle.mjs` (`npm run validate:oracle`) legge `data/seed.json` (gitignorato) e verifica:
- **A)** coerenza interna: Σ delle voci (con segno per le passività) == `netWorth` scritto dal parser;
- **B)** oracolo Excel: `netWorth` == colonna "Total" dell'Excel (`netWorthExcel`), tolleranza 1 €;
- **C)** cross-check informativo: valore voce "Azionario" ≈ Σ(quantità × ultimo prezzo) del portafoglio.

È **committato** ma **salta da solo** (exit 0) se `data/seed.json` manca → non rompe la CI pubblica,
dove i dati reali non esistono. Eseguilo **in locale** prima del push quando cambiano import o calcoli.

Esito ultima esecuzione (63 mesi, feb 2021 → apr 2026): **A) 63/63 OK · B) 63/63 OK**; C) Δ ~12%
atteso (prezzi del portafoglio fermi al 18/05/2025 vs bilancio apr 2026).

## Procedura per generare le fixture reali (quando l'Excel è disponibile)
1. metti l'Excel in `data/` (resta fuori da git);
2. `npm run import:parse` → genera `data/seed.json` e stampa il riepilogo;
3. **estrai un sottoinsieme rappresentativo** e **verifica a mano** i numeri attesi (PMC, P&L, netto mensile);
4. codifica i valori attesi:
   - nei **test sintetici** (numeri scalati/anonimizzati) → committati;
   - nella **validazione locale** (numeri reali) → gitignored.

## Definition of done (test)
- ogni nuova funzione di calcolo è accompagnata dai suoi test;
- la CI è verde sui test sintetici;
- la validazione locale è stata eseguita quando sono cambiati gli import o la logica di calcolo.
