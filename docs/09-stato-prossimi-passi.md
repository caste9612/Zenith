# 09 — Stato di avanzamento e prossimi passi

> Documento di **handoff**: fotografia aggiornata del progetto + cosa fare dopo. È il **punto di
> partenza** di ogni sessione (leggi questo per primo). **Aggiornare alla fine di ogni sessione.**
> Ultimo aggiornamento dopo le sessioni: audit Excel, icona, dividendi, pagina Rendimento +
> benchmark, gestione conti, release Windows, refactor patrimonio netto, suite di test + CI,
> validazione oracolo Excel + indicatori sul patrimonio netto + provider Yahoo (app nativa),
> **catena quotazioni multi-provider con fallback + ricerca titoli multi-provider**.

## Dove si lavora (branch)

- Lo sviluppo recente è **direttamente su `main`** (origin **`caste9612/Zenith`**, repo **pubblico**),
  con push autorizzato dal committente. `main` è tenuto **verde in CI**.
- Per continuare a casa:
  ```bash
  git fetch origin && git checkout main && git pull
  ```
- Regola operativa di queste sessioni: **commit piccoli + push su `main`**, sempre con
  `git fetch`/`pull` **prima** di ogni push. Nessun deploy automatico (vedi "Stato produzione").

## Setup rapido

1. `npm install`
2. Crea `.env` in root (mai nel repo): config **Firebase** (progetto `zenith-5768d`) + chiavi
   **Finnhub** e **Alpha Vantage**. Le stesse chiavi sono nei **GitHub Secrets** (per la CI della
   release Windows). `.env.example` elenca i campi.
3. `npm start` → genera la config + `ng serve` su http://localhost:4200 (login con le credenziali utente).
4. `npm run build` → build in `dist/zenith/browser`.
5. `npm run test:ci` → **84 test** headless (richiede **Chrome** installato).
6. **Import dall'Excel** (Excel gitignorato, es. `data/Balance Sheet.xlsx`):
   `import:parse` · `import:seed` · `import:openings` · `import:dividends` · `import:trackrecord`.
   Dopo `import:parse`: `npm run validate:oracle` confronta i totali calcolati con l'Excel
   (legge `data/seed.json`, gitignorato; salta da solo se assente — vedi `08-testing.md`).
7. **Deploy web** (manuale): `npm run deploy:hosting`. **App Windows**: push di un tag `v*` →
   GitHub Action builda e pubblica l'installer nei Releases.

## Stato produzione — RE-DEPLOY IN SOSPESO ⏳

- Sito: **https://zenith-5768d.web.app** — **indietro rispetto a `main`**: mancano la sezione
  **Indicatori** della dashboard (crescita annua / volatilità / max drawdown) e il nuovo **editor
  strumento con ricerca multi-provider**.
  Per allinearlo: **`npm run deploy:hosting`** (build + Firebase Hosting). Il resto (navbar, pagina
  Rendimento + benchmark, dividendi, gestione conti, icona) è già online.
- App Windows: **https://github.com/caste9612/Zenith/releases** (v0.1.0, `.msi`/`.exe`). Il nuovo
  **provider Yahoo** è attivo solo nell'app nativa (CORS): per provarlo serve una build Tauri (e i
  titoli vanno marcati `provider: 'yahoo'`). Per pubblicare: push di un tag `v*` → GitHub Action.

## Fatto in questa sessione — quotazioni multi-provider + ricerca

> Richiesta: poter sfruttare **tutti** i provider insieme (più copertura, meno rischio di esaurire la
> quota di una fonte) e una **ricerca** che aiuti a scegliere fonte+simbolo. Fatto a fasi (84 test
> verdi, pushate su `main`). Resta la verifica **on-device** (Yahoo gira solo in Tauri).

- **Simboli per-provider** (`Instrument.providerSymbols`) + helper `symbolForProvider`: lo stesso
  titolo può avere ticker diversi per fonte (`FLOW.AS` Yahoo, `FLOW.AMS` Alpha Vantage). I provider
  Finnhub/Alpha Vantage/Yahoo dichiarano `supports()` in base alla **capacità** di quotare. Additivo
  e retro-compatibile.
- **Catena multi-provider con fallback** (`QuoteService`): prova il provider primario, poi gli altri
  in ordine quota-friendly (**Yahoo nativo → Finnhub → Alpha Vantage** per ultimo, quota 25/g). Un
  titolo va in `failed` solo se **tutti** falliscono. **Fix valuta**: la conversione in EUR usa la
  valuta della **quotazione** (`q.currency`), non quella salvata → CKH (HKD) e TIBN (CHF) corretti.
- **Ricerca titoli** (`SymbolSearchService`): cerca su **Yahoo** (globale, app nativa) + **Finnhub**
  (USA, anche browser); propone candidati {provider, simbolo, nome, borsa}. Alpha Vantage escluso (la
  sua ricerca consuma quota). La pagina **instrument-edit** ha box di ricerca, **Yahoo** tra le fonti
  e i **simboli di fallback** per più provider.
- **Verifica simboli** (via API Yahoo): confermati **FLOW.AS, ACOMO.AS, 0001.HK** (CK Hutchison, HKD),
  **TIBN.SW** (Titlis Bergbahnen, CHF), **LBTYA**. **PHO** e **POL** restano da identificare (ticker
  ambigui, nessun nome/ISIN nello storico) → si trovano con la nuova ricerca on-device.
- **Test**: da 69 a **84** (`symbolForProvider`, catena/fallback, valuta-dalla-quotazione, parser di
  ricerca Yahoo/Finnhub).

## Fatto nella sessione precedente (i 4 "prossimi passi" del handoff precedente)

- **Validazione oracolo Excel (punto 1)** ✅ — `npm run import:parse` su `data/Balance Sheet.xlsx`
  (63 mesi, feb 2021 → apr 2026). Nuovo script committato `scripts/validate/oracle.mjs`
  (`npm run validate:oracle`) che ricontrolla gli invarianti leggendo `data/seed.json` (gitignorato):
  **A)** Σ voci con segno == netWorth del parser → OK su 63/63; **B)** netWorth == colonna "Total"
  dell'Excel (±1 €) → OK su 63/63; **C)** cross-check portafoglio ↔ voce "Azionario" (informativo:
  Δ ~12% atteso, prezzi del portafoglio fermi al 18/05/2025 vs bilancio apr 2026). Salta da solo se
  il seed manca → committabile senza far fallire la CI pubblica.
- **Test mancanti (punto 2)** ✅ — da 54 a **69 test verdi**: `formatEur` (interi/decimali/zero/
  negativi/separatori), `minIntervalMs` riscritto con **fake timers** (`jasmine.clock` + drain dei
  microtask, distanza ESATTA al posto del timer reale con slack), primo test di `ValueChartComponent`.
- **Indicatori sul patrimonio netto (punto 3)** ✅ — funzioni pure `valueReturns`/`seriesMetrics` in
  `core/portfolio/metrics.ts` (riusano CAGR/volatilità/maxDrawdown; **niente Sharpe**: la serie del
  netto include i risparmi versati, non è un rendimento risk-adjusted). Nuova sezione **Indicatori**
  nella dashboard (crescita annua / volatilità / max drawdown), visibile con ≥ 3 snapshot.
- **Provider Yahoo (punto 4)** ✅ *(da verificare on-device)* — `core/quotes/yahoo.provider.ts`
  (endpoint `v8/finance/chart`), registrato nel `QuoteService`. Gated su **Tauri**: nel browser
  `supports()` è false (CORS) e i titoli `yahoo` restano intatti come i manuali; nell'app nativa
  vengono quotati e convertiti in EUR. Parsing isolato in `parseYahooQuote` (puro, testato). **Resta
  da fare**: build Tauri, marcare TIBN/CKH/PHO/POL con `provider: 'yahoo'` e i simboli Yahoo giusti,
  e verificare le quote dal vivo.

## Fatto nelle sessioni recenti (oltre al handoff precedente)

- **Audit Excel**: confermato cosa mancava (dividendi, realizzato, track record, benchmark); cambio
  valute verificato OK (LBTYA 12,51 USD × 0,859 = 10,74 €); allocazione e snapshot coerenti.
- **Icona "Vetta + zenit"** (`public/icon.svg`): sostituisce il rombo e il favicon di Angular;
  rigenerate tutte le icone **Tauri** (desktop/Android/iOS) con `tauri icon`. PWA installabile (manifest).
- **Dividendi importati**: €1.111 su 25 mesi → `import:dividends` (movimenti `dividend`, id
  `div-YYYY-MM`, idempotenti). Il portafoglio mostra contatore + totale.
- **Pagina Rendimento** (`/portfolio/rendimento`): rendimento totale scomposto (realizzato /
  dividendi / non realizzato) + **grafico multi-linea** portafoglio vs **S&P 500 / NASDAQ** +
  confronto finale. Dati dal **track record** mensile importato (`import:trackrecord` → collezione
  **`portfolioHistory`**, 45 mesi 2022→2026). Componente riusabile `MultiLineChartComponent`.
  **Indicatori** CAGR/volatilità/Sharpe/maxDD in `core/portfolio/metrics.ts` (sessione PC).
- **Dashboard**: torta **ripartizione per classe** (oltre a intestatario e voce); grafico del
  patrimonio interattivo (`ValueChartComponent`).
- **Portafoglio ↔ patrimonio**: il nuovo snapshot precompila le voci `linkedToPortfolio` (es.
  "Azionario") dal **valore live** del portafoglio (`PortfolioService.currentValueEur`).
- **Gestione conti/voci** (`/accounts`, `/accounts/:id|new`): lista + editor per rinominare,
  riclassificare, riordinare, **disattivare** o eliminare le voci; link da Impostazioni. Le voci
  disattivate non compaiono nei nuovi snapshot (lo storico resta).
- **Quotazioni europee**: chiave **Alpha Vantage** attiva; **FLOW**/**ACOMO** (Amsterdam, `.AMS`)
  ora automatiche. Risolto il **rate-limit 1 req/s** di Alpha Vantage (`minIntervalMs` nel
  `QuoteService` distanzia le chiamate). **TIBN/CKH/PHO/POL** restano **manuali** (nessun simbolo
  AV pulito).
- **App Windows**: workflow `.github/workflows/release-windows.yml` (Tauri su `windows-latest`) →
  installer `.msi`/`.exe` nei Releases a ogni tag `v*`. Config/chiavi ricostruite in CI dai **GitHub Secrets**.
- **Refactor patrimonio netto**: logica in funzioni pure `core/balance/net-worth.ts` (niente più
  duplicazione tra dashboard, editor snapshot e parser). Numeri invariati (verificati dal vivo).
- **Suite di test + CI**: **54 test verdi**, runner headless (`npm run test:ci`), workflow
  `.github/workflows/test.yml` (push su `main` + PR). Dettaglio e checklist in `docs/08-testing.md`.
- **Formattazione**: `useGrouping` forza il separatore delle migliaia (it-IT "min2" ometteva
  1.111/2.707) in `core/money/format.ts`.

## Decisioni di prodotto (da rispettare)

- **Niente depositi/prelievi** sui conti; **niente report/export**; **crypto** senza drill-down.
- **Indicatori**: rendimenti **time-weighted**; risk-free Sharpe **0%** (`RISK_FREE_ANNUAL`).
- **Rendimento/benchmark** in **pagina dedicata** (`/portfolio/rendimento`), non dentro il portafoglio.
- **Dividendi / track record / realizzato / benchmark** importati dall'Excel (dati storici, sola lettura).
- **Quotazioni multi-provider**: ogni titolo può avere simboli per più fonti (`providerSymbols`); il
  refresh prova il **primario** poi gli altri in ordine quota-friendly (Yahoo nativo → Finnhub →
  Alpha Vantage). **Yahoo** copre i mercati scoperti ma **solo nell'app nativa** (CORS); nel browser
  restano Finnhub/Alpha Vantage. La conversione in EUR usa la valuta della quotazione.
- Sviluppo su **`main`** con push diretto (autorizzato in queste sessioni).

## Prossimi passi (ordine consigliato)

> I 4 passi del handoff precedente sono stati affrontati tutti (vedi "Fatto in questa sessione").
> Da qui:

1. **Re-deploy web** (per mostrare gli **Indicatori** della dashboard): `npm run deploy:hosting`.
2. **Assegna le fonti e verifica on-device** (chiude il punto 4): build Tauri (`npm run tauri:build`
   o tag `v*`). Nell'**editor strumento** usa la **ricerca** per assegnare Yahoo ai titoli scoperti
   (TIBN→`TIBN.SW`, CKH→`0001.HK`, FLOW→`FLOW.AS`, ACOMO→`ACOMO.AS`) e **identificare PHO/POL**. Poi
   controlla le quote dal vivo (prezzo + conversione EUR per HKD/CHF). Se reggono, via i prezzi
   manuali per quei titoli. Eventuale 2ª fonte come fallback dall'editor.
3. **(Opzionale) Altri test di componente**: grafico multi-linea, dashboard, snapshot editor; e la
   precompilazione del nuovo snapshot dal mese precedente (logica nel componente).
4. **(Opzionale) Indicatori del netto — rifiniture**: per ora sono cumulativi sull'intera serie;
   eventuale finestra mobile o confronto con un benchmark.

## Mappa rapida dei file chiave

- `src/app/app.ts|html|scss` — shell, **navbar** e pannello impostazioni.
- `src/app/core/balance/net-worth.ts` — patrimonio netto (puro, **testato**).
- `src/app/core/portfolio/metrics.ts` — indicatori (puro, **testato**).
- `src/app/core/portfolio/portfolio.service.ts` — transazioni → posizioni, **PMC/P&L** (**testato**).
- `src/app/core/quotes/*` — provider (Finnhub/Alpha Vantage/**Yahoo** solo Tauri/manuale) + **FX** (**testati**); `quote-provider.ts` (`symbolForProvider`), `quote.service.ts` (**catena multi-provider con fallback**, `minIntervalMs`), `symbol-search.ts` (**ricerca** Yahoo+Finnhub). `parseYahooQuote` puro.
- `src/app/core/money/format.ts` — formattazione EUR/% (**testata**).
- `src/app/features/portfolio/performance.ts` — pagina **Rendimento** + `shared/multi-line-chart.ts`.
- `src/app/features/accounts/*` — **gestione conti/voci**.
- `src/app/shared/allocation-pie.ts` (**testato**) · `value-chart.ts` — grafici riusabili.
- `src/app/core/data/*` — `BaseRepository`, repository (incl. `PortfolioHistoryRepository`), bridge realtime.
- `scripts/import/*` — parser Excel + seed + dividendi + track record.
- `scripts/validate/oracle.mjs` — validazione **oracolo** locale (`npm run validate:oracle`), legge `data/seed.json`.
- `src/app/core/portfolio/metrics.ts` — indicatori titoli + `valueReturns`/`seriesMetrics` per il **patrimonio netto** (**testati**).
- `.github/workflows/` — `test.yml` (CI test) · `release-windows.yml` (build+release Tauri).

## Documenti da leggere (contesto)

Vedi l'elenco in `CLAUDE.md` (docs `00`–`08`). Questo `09` è il punto di partenza operativo per
capire **a che punto siamo** e **cosa fare adesso**.
