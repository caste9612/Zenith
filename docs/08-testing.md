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
- [ ] `formatEur` — interi, con decimali, zero, negativi, separatori `it-IT`.
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
- [ ] casi limite — quantità 0, vendita > posseduto (errore atteso).

### `core/quotes/quote.service.ts` — `quote.service.spec.ts`
- [x] `isStale` — sotto/sopra soglia, confine esatto, `lastPriceAt` mancante.
- [x] `refreshAll` — conversione in **EUR** via FX, lista `failed`, **non** sovrascrive i simboli non risolti. *(Resta: `minIntervalMs` con mock dei timer.)*
- [x] selezione provider (`supports`).

### `core/quotes/fx.provider.ts`
- [ ] `getRate` — stessa valuta → `1`, parsing risposta **Frankfurter**, **fallback** `open.er-api`, errore → `null` (mock di `platformFetch`).

### Snapshot / patrimonio netto
- [ ] `netWorth` = somma asset − passività (`LIABILITY_CLASSES`).
- [ ] aggregati `byOwner` e `byAssetClass`.
- [ ] precompilazione del nuovo snapshot dai valori del mese precedente.

### Indicatori (Sharpe & co.) — *quando implementati*
- [ ] serie dei **rendimenti mensili** dal track record.
- [ ] **Sharpe** (media/deviazione standard × annualizzazione), **volatilità**, **max drawdown**, **CAGR**.
- [ ] casi: serie di 1 punto, serie piatta (dev. std 0 → niente divisione per zero), valori noti calcolati a mano.

### Benchmark (S&P / NASDAQ)
- [ ] flusso netto investito (acquisti − vendite) applicato all'indice → unità simulate, valore, confronto col portafoglio.

## Suite di validazione locale (oracolo = Excel)
Script/test che legge `data/seed.json` (gitignored) e verifica che l'app riproduca i numeri veri:
- ricostruisce le posizioni dai movimenti e le confronta con gli holding attesi;
- somma gli snapshot mensili e confronta con i **totali storici** dell'Excel (con tolleranza di arrotondamento);
- valore di portafoglio e P&L vs valori dell'Excel.

Eseguita **in locale** prima del push; la procedura va documentata nel README quando la suite esiste.

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
