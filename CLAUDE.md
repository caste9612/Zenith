# CLAUDE.md — Zenith (Portfolio & Balance Sheet)

> Questo file viene letto automaticamente da Claude Code a ogni sessione.
> È la "costituzione" del progetto: in caso di conflitto con un prompt estemporaneo, **prevale questo file**.

## Cos'è
App **personale a utente singolo** che sostituisce un Excel storico. Traccia:
- il **patrimonio netto** (balance sheet), aggiornato **mensilmente** con dati manuali (conti bancari, fondo pensione, immobili, veicoli, liquidità, passività);
- un **portafoglio titoli** con quotazioni, prezzo di carico, P&L e storico.

Due target dalla **stessa codebase**: **desktop Windows** e **Android**.

## Regole non negoziabili
- **Resta 100% gratuito.** Backend Firebase piano **Spark** (nessuna carta). **Vietato** introdurre Cloud Functions o qualsiasi servizio che richieda il piano Blaze. Tutta la logica è **lato client**.
- **Quotazioni: niente streaming.** Si aggiornano solo (1) all'apertura dell'app e (2) con un pulsante "Aggiorna" manuale. Le quote vanno salvate in Firestore con timestamp; all'avvio si rifà la fetch solo se la quota è più vecchia di una soglia configurabile.
- **API key mai nel repository.** Vanno in un file di ambiente locale ignorato da git (vedi `.env.example`).
- **Dati finanziari fuori da git.** L'Excel dell'utente (`data/*.xlsx`) è gitignorato: non committarlo mai.
- Valuta base **EUR**.

## Metodo di lavoro (IMPORTANTE)
Si procede **per fasi** e **alla fine di ogni fase ti fermi e aspetti la mia approvazione esplicita** prima di passare alla successiva. Non saltare avanti.

La **prima cosa in assoluto**: quando l'Excel sarà presente in `data/`, leggilo e da quello deduci lo schema reale, **prima** di scrivere codice. Se l'Excel non c'è ancora, fermati e chiedimelo.

## Documentazione di progetto
Leggi questi documenti come parte del contesto:
- @docs/00-build-prompt.md — il prompt operativo completo, punto di partenza
- @docs/01-architecture.md — stack e decisioni tecniche con motivazioni
- @docs/02-data-model.md — modello dati Firestore (provvisorio, da affinare sull'Excel)
- @docs/03-roadmap.md — piano a fasi con stop-gate
- @docs/04-design-guidelines.md — principi di design e UX
- @docs/05-firestore-security-rules.md — regole di sicurezza Firestore
- @docs/06-glossario.md — glossario del dominio (linguaggio comune)
- @docs/07-performance.md — strategia di performance e reattività (zoneless, Signals, offline, lazy)

## Stack (sintesi)
Angular (LTS, standalone, Signals, **change detection zoneless + OnPush**) · Firebase (Firestore + Auth email/password, offline abilitato; letture realtime → Signal) · Tauri 2 per impacchettare Windows + Android · plugin HTTP di Tauri per le API di mercato (evita la CORS del browser).

> Performance e reattività sono un requisito di prima classe: vedi `docs/07-performance.md` per le regole vincolanti.
