# 09 — Stato di avanzamento e prossimi passi

> Documento di **handoff**: fotografia aggiornata del progetto + cosa fare dopo. È il **punto di
> partenza** di ogni sessione (leggi questo per primo). **Aggiornare alla fine di ogni sessione.**
> Ultimo aggiornamento dopo le sessioni: audit Excel, icona, dividendi, pagina Rendimento +
> benchmark, gestione conti, release Windows, refactor patrimonio netto, suite di test + CI.

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
5. `npm run test:ci` → **54 test** headless (richiede **Chrome** installato).
6. **Import dall'Excel** (Excel gitignorato in root, `Balance Sheet.xlsx`):
   `import:parse` · `import:seed` · `import:openings` · `import:dividends` · `import:trackrecord`.
7. **Deploy web** (manuale): `npm run deploy:hosting`. **App Windows**: push di un tag `v*` →
   GitHub Action builda e pubblica l'installer nei Releases.

## Stato produzione — DEPLOY IN SOSPESO ⚠️

- Sito: **https://zenith-5768d.web.app** · App Windows: **https://github.com/caste9612/Zenith/releases** (v0.1.0, `.msi`/`.exe`).
- L'ultimo deploy hosting copre **icona + dividendi + dashboard**. **Non** sono ancora in
  produzione: **pagina Rendimento** completa, **navbar nuova**, **indicatori**, refactor netto, test.
- **Azione**: per allineare la produzione a `main` → `npm run deploy:hosting` (i test/refactor non
  cambiano la UI, ma le feature sì). È l'unica cosa davvero in sospeso.

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
- **Quotazioni**: FLOW/ACOMO auto via Alpha Vantage; il resto **manuale** finché non si userà
  **Yahoo** (solo nell'app nativa, senza CORS).
- Sviluppo su **`main`** con push diretto (autorizzato in queste sessioni).

## Prossimi passi (ordine consigliato)

1. **(Decisione) Deploy** della versione unificata: `npm run deploy:hosting`. Unica cosa davvero in sospeso.
2. **Validazione locale sull'Excel** (oracolo): con l'Excel in `data/`, `npm run import:parse` →
   confrontare i totali calcolati dall'app con quelli reali (fixture reali gitignorate; vedi
   `08-testing.md`). Da fare dopo gli import (dividendi/track record).
3. **(Opzionale) Altri test**: casi `formatEur` (interi/decimali), altri test di componente
   (grafici), `minIntervalMs` con **mock dei timer** al posto del test a timer reali.
4. **(Opzionale) Indicatori sul patrimonio netto**: estendere CAGR/volatilità/… anche alla serie
   degli **snapshot** del netto (non solo ai titoli).
5. **(Futuro) Quotazioni europee complete**: Yahoo nell'app nativa Tauri per TIBN/CKH ecc.

## Mappa rapida dei file chiave

- `src/app/app.ts|html|scss` — shell, **navbar** e pannello impostazioni.
- `src/app/core/balance/net-worth.ts` — patrimonio netto (puro, **testato**).
- `src/app/core/portfolio/metrics.ts` — indicatori (puro, **testato**).
- `src/app/core/portfolio/portfolio.service.ts` — transazioni → posizioni, **PMC/P&L** (**testato**).
- `src/app/core/quotes/*` — provider quotazioni (Finnhub/Alpha Vantage/manuale) + **FX** (**testati**); `minIntervalMs` per il rate limit.
- `src/app/core/money/format.ts` — formattazione EUR/% (**testata**).
- `src/app/features/portfolio/performance.ts` — pagina **Rendimento** + `shared/multi-line-chart.ts`.
- `src/app/features/accounts/*` — **gestione conti/voci**.
- `src/app/shared/allocation-pie.ts` (**testato**) · `value-chart.ts` — grafici riusabili.
- `src/app/core/data/*` — `BaseRepository`, repository (incl. `PortfolioHistoryRepository`), bridge realtime.
- `scripts/import/*` — parser Excel + seed + dividendi + track record.
- `.github/workflows/` — `test.yml` (CI test) · `release-windows.yml` (build+release Tauri).

## Documenti da leggere (contesto)

Vedi l'elenco in `CLAUDE.md` (docs `00`–`08`). Questo `09` è il punto di partenza operativo per
capire **a che punto siamo** e **cosa fare adesso**.
