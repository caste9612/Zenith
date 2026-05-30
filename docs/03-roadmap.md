# 03 — Roadmap incrementale

Si procede **una fase alla volta**. **Alla fine di ogni fase, fermati e attendi l'approvazione esplicita** del committente prima di iniziare la successiva. Non anticipare lavoro delle fasi seguenti.

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
- Acquisto, **vendita totale/parziale**, dividendi, depositi/prelievi.
- Prezzo medio di carico e calcolo **plus/minusvalenze (P&L)**.
- Storicizzazione dei movimenti.
- **Stop-gate.**

## Fase 3 — Avanzate
- Supporto **BTP/bond** con override manuale del prezzo.
- Multivaluta avanzata e gestione cambi.
- **Asset allocation** e indicatori (es. indice di Sharpe).
- Report ed export.
- **Stop-gate.**

## Idee future (backlog, non pianificate)
- Notifiche/promemoria per lo snapshot mensile.
- Backup/export periodico dei dati.
- Eventuale aggiornamento quotazioni schedulato (valutare solo se si accetta il passaggio a Blaze).
