# 03 — Roadmap incrementale

Si procede **per fasi**, con confronto col committente tra una e l'altra. *(Su richiesta del committente, lo sviluppo procede in autonomia sulle funzioni chiare; ci si confronta sui punti che richiedono decisioni o credenziali.)*

## Stato attuale (aggiornato)
- **Fase 0 — Fondamenta:** ✅ **completata** — Angular 20 zoneless, Firebase (Auth + Firestore offline), guscio Tauri, design system dark/light, deploy su Firebase Hosting.
- **Fase 1 — MVP:** ✅ **completata** — snapshot mensili (crea/modifica/elimina, precompilati), import dello storico dall'Excel, dashboard (netto + variazione + grafico + ripartizione), portafoglio con quotazioni.
- **Fase 2 — Transazioni e P&L:** ✅ **completata** — acquisto/vendita (prezzo = importo/quantità), dividendi + contatore, P&L da **costo medio**, movimenti con eliminazione. *(Depositi/prelievi sui conti esclusi per scelta del committente: a fine mese si inserisce il saldo dei conti nello snapshot, e tanto basta.)*
- **Fase 3 — Avanzate:** ✅ **completata** — multivaluta + cambio in EUR, quote **multi-provider con catena di fallback** (Finnhub/Alpha Vantage/**Yahoo** solo Tauri/manuale) + **ricerca titoli** per fonte/simbolo, prezzo manuale per BTP/non coperti, allocazione a torta (per titolo e per classe), grafico interattivo, gestione conti/voci, **import dividendi/track-record/plusvalenze realizzate dall'Excel**, pagina **Rendimento** con **benchmark S&P/NASDAQ** (serie `portfolioHistory`) e **indicatori** (CAGR, volatilità, Sharpe, max drawdown), app Windows pubblicata via **GitHub Releases** (CI Tauri).
- **Fase 3+ — Cash flow, sicurezza, UX:** ✅ — pagina **Cash flow** (entrate/uscite/risparmio) con
  **editor "Nuovo mese"** (lordo/netto/uscite → **tassazione** e **risparmio** calcolati) e
  **tassazione per anno** (netto % del lordo); **tasso di risparmio** in dashboard **basato sul
  patrimonio** (crescita del netto mese su mese, in **%/€**, per intestatario, con **filtro anno**);
  **ripartizione** (torta Classe/Voce/Intestatario) e **composizione nel tempo** unificate con toggle;
  **registro accessi** in Impostazioni; storico del patrimonio (composizione/drill); **fix layout
  mobile** (bottom-nav). App desktop **v0.5.0** (auto-updater attivo).
- **Export Excel:** ✅ — **Impostazioni → Esporta** genera un `.xlsx` (lato client, **ExcelJS** lazy)
  con 7 fogli (Riepilogo, Patrimonio, Portafoglio, Movimenti, Operazioni chiuse, Track record, Cash
  flow) + foglio **Grafici** (immagini PNG da canvas); su **desktop** salvataggio nativo (plugin
  Tauri dialog/fs). Backup + futura sostituzione dell'Excel. App **v0.6.0**.
- **Qualità — Test:** ✅ **in corso** — runner headless + CI attivi (`npm run test:ci`, workflow `test.yml`); **116 test verdi** su metrics (+ indicatori del **patrimonio netto**), format (incl. `formatEur`), **portfolio.service** (PMC/P&L), **quote.service** (staleness/FX/failed/**rate-limit con timer finti**), **fx.provider**, **yahoo.provider** (parsing + gating Tauri), **catena multi-provider/fallback** + `symbolForProvider`, **ricerca titoli** (`symbol-search`), **patrimonio netto** (`core/balance/net-worth`, incl. **serie storiche**) e **test di componente** (AllocationPie, ValueChart, **StackedArea**, **BarChart**), **cash flow** (`savingRate`/`annualSummary` incl. **`netRate`** netto/lordo), **`netWorthGrowthSeries`** (crescita %/€ del patrimonio) e **registro accessi** (`describeDevice`), **export** (`core/export/sheets`: patrimonio/portafoglio/cash flow/realized). In più la **validazione oracolo** locale (`npm run validate:oracle`) e la **verifica indipendente** end-to-end (`npm run verify`) contro l'Excel. *Mancano:* altri test dei componenti (grafico multi-linea, dashboard, editor snapshot/cash flow). Piano in `docs/08-testing.md`.

> **Fuori ambito (scelta del committente):** depositi/prelievi **sui conti** (il saldo mensile nello
> snapshot basta), **report analitici**, **dettaglio del fondo crypto** (la voce "Crypto" resta nel
> patrimonio, ma senza drill-down dedicato). *(L'**export Excel** — backup/sostituzione dell'Excel —
> è invece **implementato**, vedi sopra.)*
> *(Eccezione: il **Cash flow** — entrate/uscite/risparmio di **Antonio** — è ora **in ambito**, sia
> dall'import sia con inserimento manuale dall'editor. È un flusso di reddito, distinto dai
> depositi/prelievi conto per conto.)*

## Fase 0 — Fondamenta
1. Leggi `data/patrimonio.xlsx` (se manca, fermati e chiedilo).
2. Proponi schema dati Firestore (a partire da `02-data-model.md`) + piano di import. **Attendi conferma.**
3. Scaffolding:
   - progetto Angular (standalone, Signals);
   - integrazione Firebase (Auth email/password, Firestore con offline);
   - guscio Tauri 2 (build Windows; setup Android);
   - design system di base (token colore/spaziatura/tipografia, dark/light) e navigazione.
4. **Stop-gate.**

## Fase 1 — MVP
- Balance sheet manuale con **snapshot mensili** (precompilati dal mese precedente).
- **Import** dello storico dall'Excel.
- Portafoglio con quotazioni (refresh all'avvio + pulsante manuale; cache in Firestore).
- Dashboard: **patrimonio netto** attuale + variazione + grafico storico pulito; sintesi per classe di asset.
- **Stop-gate.**

## Fase 2 — Transazioni e P&L
- Acquisto, **vendita totale/parziale**, dividendi. *(Depositi/prelievi sui conti: fuori ambito — basta il saldo mensile.)*
- Prezzo medio di carico e calcolo **plus/minusvalenze (P&L)**.
- Storicizzazione dei movimenti.
- **Stop-gate.**

## Fase 3 — Avanzate
- Supporto **BTP/bond** con override manuale del prezzo. ✅
- Multivaluta avanzata e gestione cambi. ✅
- **Asset allocation** ✅ e **indicatori** (CAGR, volatilità, Sharpe, max drawdown). ✅
- **Export Excel** ✅ (Impostazioni → Esporta: 7 fogli + grafici, salvataggio desktop). ~~Report analitici~~ *(fuori ambito)*
- **Stop-gate.**

## Qualità — Test
- Suite di test sulla **logica finanziaria**, validata sui dati reali dell'Excel come oracolo (senza versionarli).
- Piano completo, vincoli e checklist per modulo: **`docs/08-testing.md`**.

## Idee future (backlog, non pianificate)
- Notifiche/promemoria per lo snapshot mensile.
- Backup periodico dei dati. *(Distinto dall'export "report", fuori ambito: qui si intende solo la messa in sicurezza dei dati.)*
- Eventuale aggiornamento quotazioni schedulato (valutare solo se si accetta il passaggio a Blaze).
- **Sicurezza avanzata** (App Check, regole Firestore validate, eventuale MFA): **valutata e rinviata** dal committente — vedi `05`. *(Alert email su accessi sospetti richiederebbe Blaze/Cloud Functions → escluso.)*
- **Verifica on-device dei provider quotazioni** (Yahoo in Tauri): assegnare le fonti ai titoli scoperti e controllare le quote dal vivo.
