# 09 — Stato di avanzamento e prossimi passi

> Documento di **handoff**: fotografia aggiornata del progetto + cosa fare dopo, pensato per
> guidare la prossima sessione di Claude Code (sul PC). **Aggiornare alla fine di ogni sessione.**

## Dove si lavora (branch)

- Tutto il lavoro recente è sul branch **`claude/project-analysis-overview-cld0i`**, già pushato su `origin` (`caste9612/zenith`).
- Per continuare sul PC:
  ```bash
  git fetch origin
  git checkout claude/project-analysis-overview-cld0i
  ```
- Per consolidare quando sei pronto: apri una **PR** verso `main` (o fai il merge). _Regola di progetto: si sviluppa su branch dedicati, non si pusha su `main` senza ok esplicito._

## Setup rapido (PC)

1. `npm install`
2. Copia `.env.example` → `.env` e compila la **config Firebase** (mai nel repo). (Opzionale: chiavi **Finnhub** / **Alpha Vantage** per le quotazioni.)
3. `npm start` → genera la config + `ng serve` su http://localhost:4200
4. `npm run build` → build di produzione in `dist/zenith/browser`
5. **Test:** `npm test` (Karma/Jasmine) — ⚠️ vedi "Prossimi passi #1": serve Chrome e, consigliato, una config **ChromeHeadless** (al momento i test non sono ancora stati eseguiti col runner ufficiale, solo verificati a parte).

## Fatto nelle ultime sessioni

- **Impostazioni nella navbar.** Spostate dalla pagina dedicata a un **pannello a comparsa** (icona ingranaggio accanto al toggle tema, sia sidebar desktop sia topbar mobile). Rimossa la pagina/route `/settings`; bottom-nav passata a **3 voci**.
- **Indicatori** nella pagina **Rendimento**: **CAGR**, **volatilità** annualizzata, **Sharpe** (risk-free 0%), **max drawdown**. Rendimenti mensili **time-weighted** (scorporano i flussi netti). Logica in `src/app/core/portfolio/metrics.ts` (funzioni pure).
- **Primi test** (prima applicazione di `docs/08-testing.md`): `metrics.spec.ts` (15 casi) e `format.spec.ts` (4). Aggiunto `formatPercentPlain` in `core/money/format.ts`.
- **Documentazione**: nuovo `docs/08-testing.md` (strategia di test) e roadmap aggiornata.

## Decisioni di prodotto (da rispettare)

- **Niente depositi/prelievi** sui conti: a fine mese si inserisce il **saldo** dei conti nello snapshot, e tanto basta.
- **Niente report/export.**
- **Crypto**: resta come voce del patrimonio, **senza** drill-down/dettaglio dedicato.
- **Indicatori**: rendimenti **time-weighted**; risk-free dello Sharpe = **0%** (costante `RISK_FREE_ANNUAL` in `metrics.ts`, facile da cambiare).

## Prossimi passi (ordine consigliato)

1. ✅ **Runner di test (ChromeHeadless) — FATTO.** `npm run test:ci` (= `config:gen` + `ng test --watch=false --browsers=ChromeHeadless`) gira in locale e in **CI** (`.github/workflows/test.yml`, su push a `main` e su PR). Scelto il launcher **ChromeHeadless** integrato: passare un `karma.conf.js` custom al builder `@angular/build:karma` disattivava l'iniezione di Jasmine (`describe is not defined`), e `--no-sandbox` non serve sui runner non-root. I service zoneless si testano con `TestBed` + `provideZonelessChangeDetection()` e repository finti.
2. **Ampliare la suite** secondo la checklist di `docs/08-testing.md`:
   - ✅ `core/portfolio/portfolio.service.ts` — **PMC / P&L** (costo medio, vendite parziali/totali, dividendi, `deleteTransaction`, `currentValueEur`) → `portfolio.service.spec.ts`.
   - ✅ `core/quotes/quote.service.ts` — **staleness**, conversione **EUR**, lista `failed`, selezione provider → `quote.service.spec.ts`. **Resta:** il rate-limit `minIntervalMs` (mock dei timer).
   - ✅ `core/quotes/fx.provider.ts` — Frankfurter + fallback `open.er-api` + `null`, con spy su `window.fetch` → `fx.provider.spec.ts`.
   - ✅ **Snapshot / patrimonio netto** — `core/balance/net-worth.ts` (funzioni pure `computeNetWorth`, `totalsByOwner`, `totalsByAssetClass`) estratte da dashboard/editor/parser e testate → `net-worth.spec.ts`. Resta la precompilazione (logica nel componente).
3. **Validazione locale sull'Excel.** Quando carichi l'Excel in `data/`: `npm run import:parse` → confrontare i totali calcolati dall'app con quelli reali (fixture reali gitignorate, vedi `08-testing.md`).
4. **(Opzionale) Indicatori sul patrimonio netto.** Estendere gli indicatori anche alla serie degli **snapshot** (non solo al portafoglio titoli).

## Mappa rapida dei file chiave

- `src/app/app.ts` · `app.html` · `app.scss` — shell, navbar e **pannello impostazioni**.
- `src/app/core/portfolio/metrics.ts` — indicatori (puro, **testato**).
- `src/app/core/portfolio/portfolio.service.ts` — transazioni → posizioni, **PMC/P&L** _(da testare)_.
- `src/app/core/quotes/*` — provider quotazioni (Finnhub/Alpha Vantage/manuale) + **FX** _(da testare)_.
- `src/app/core/money/format.ts` — formattazione EUR/% (**testato** in parte).
- `src/app/features/portfolio/performance.ts` — pagina **Rendimento** (indicatori + benchmark).
- `src/app/core/data/*` — `BaseRepository`, repository, bridge realtime `collectionSignal`/`docSignal`.

## Documenti da leggere (contesto)

Vedi l'elenco in `CLAUDE.md` (docs `00`–`08`). Questo `09` è il punto di partenza operativo per capire **a che punto siamo** e **cosa fare adesso**.
