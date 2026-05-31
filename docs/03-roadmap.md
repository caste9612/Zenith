# 03 — Roadmap incrementale

Si procede **per fasi**, con confronto col committente tra una e l'altra. *(Su richiesta del committente, lo sviluppo procede in autonomia sulle funzioni chiare; ci si confronta sui punti che richiedono decisioni o credenziali.)*

## Stato attuale (aggiornato)
- **Fase 0 — Fondamenta:** ✅ **completata** — Angular 20 zoneless, Firebase (Auth + Firestore offline), guscio Tauri, design system dark/light, deploy su Firebase Hosting.
- **Fase 1 — MVP:** ✅ **completata** — snapshot mensili (crea/modifica/elimina, precompilati), import dello storico dall'Excel, dashboard (netto + variazione + grafico + ripartizione), portafoglio con quotazioni.
- **Fase 2 — Transazioni e P&L:** ✅ **completata** — acquisto/vendita (prezzo = importo/quantità), dividendi + contatore, P&L da **costo medio**, movimenti con eliminazione. *(Depositi/prelievi sui conti esclusi per scelta del committente: a fine mese si inserisce il saldo dei conti nello snapshot, e tanto basta.)*
- **Fase 3 — Avanzate:** 🔶 **parziale** — multivaluta + cambio in EUR, quote multi-provider (Finnhub/Alpha Vantage/manuale), prezzo manuale per BTP/non coperti, allocazione a torta, grafico interattivo, **benchmark S&P/NASDAQ** (pagina Rendimento). *Manca:* **indicatori** (es. Sharpe).
- **Qualità — Test:** 🔶 **da avviare** — suite di test sulla logica finanziaria; piano e checklist in `docs/08-testing.md`.

> **Fuori ambito (scelta del committente):** depositi/prelievi sui conti, **report/export**, **dettaglio del fondo crypto** (la voce "Crypto" resta nel patrimonio, ma senza drill-down dedicato).

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
- **Asset allocation** ✅ e **indicatori** (es. indice di Sharpe). ⬅️ prossimo
- ~~Report ed export.~~ *(fuori ambito)*
- **Stop-gate.**

## Qualità — Test
- Suite di test sulla **logica finanziaria**, validata sui dati reali dell'Excel come oracolo (senza versionarli).
- Piano completo, vincoli e checklist per modulo: **`docs/08-testing.md`**.

## Idee future (backlog, non pianificate)
- Notifiche/promemoria per lo snapshot mensile.
- Backup periodico dei dati. *(Distinto dall'export "report", fuori ambito: qui si intende solo la messa in sicurezza dei dati.)*
- Eventuale aggiornamento quotazioni schedulato (valutare solo se si accetta il passaggio a Blaze).
