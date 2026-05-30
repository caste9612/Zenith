# 00 — Prompt operativo

Punto di partenza per Claude Code. Le decisioni di dettaglio sono nei documenti `01`–`05`; qui c'è la sintesi operativa.

## Obiettivo
Costruisci un'app personale (utente singolo) per sostituire un Excel storico, che tracci:
- il **patrimonio netto** (balance sheet), aggiornato **mensilmente** con dati manuali (conti, fondo pensione, immobili, veicoli, liquidità, passività);
- un **portafoglio titoli** con quotazioni, prezzo di carico, P&L e storico.

Target: **Windows desktop** e **Android**, stessa codebase. Sviluppo **incrementale** con stop-gate tra le fasi.

## Prima cosa da fare
1. Verifica la presenza di `data/patrimonio.xlsx`. Se manca, **fermati e chiedilo**.
2. Se c'è, **leggilo**: deduci entità, colonne, classi di asset e struttura dello "storico".
3. Proponi uno **schema dati Firestore** (partendo da `docs/02-data-model.md`) e un **piano di import**.
4. **Fermati e attendi la mia conferma** prima di generare codice.

## Vincoli (vedi anche CLAUDE.md)
- 100% gratuito; Firebase Spark; **niente Cloud Functions**; logica lato client.
- Quotazioni **non in streaming**: refresh all'avvio + pulsante manuale; cache in Firestore con timestamp e soglia di freschezza.
- `QuoteProvider` astratto (strategy pattern). Implementazione iniziale: Finnhub (azioni/ETF) + FX gratuita (EUR/USD). **BTP/bond a valore manuale** (override per posizione).
- API key in `.env` (mai nel repo). Valuta base EUR; conversione per strumenti in altra valuta.

## Operazioni UX che devono essere semplicissime
- **Aggiungere una posizione** (cerca simbolo → quantità → prezzo di carico → conto).
- **Vendere** totale o parziale (quantità o "tutto" → prezzo → aggiorna holding, registra transazione, ricalcola P&L).
- **Snapshot mensile** del balance sheet, precompilato con i valori del mese precedente.

## Design
Vedi `docs/04-design-guidelines.md`: interfaccia molto curata ma **non affollata**, ariosa, ben organizzata; dashboard con patrimonio netto in evidenza e grafico storico pulito; dark/light mode.

## Procedura
Procedi secondo `docs/03-roadmap.md`, **una fase alla volta**, fermandoti per la mia approvazione dopo ciascuna. Inizia dalla **Fase 0**.
