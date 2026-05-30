# Zenith

App personale (utente singolo) per tracciare **patrimonio netto** e **portafoglio titoli**, in sostituzione di un Excel storico. Gira su **Windows** (desktop) e **Android** dalla stessa codebase. Nome in codice: **Zenith**.

Questo repository contiene, per ora, **solo la documentazione** che guida lo sviluppo con Claude Code. Il codice verrà generato a fasi.

## Stack
- **Frontend:** Angular (LTS, standalone components, Signals)
- **Backend:** Firebase — Firestore + Authentication (piano gratuito Spark)
- **Packaging:** Tauri 2 (eseguibile Windows + APK Android)
- **Quotazioni:** Finnhub (azioni/ETF) + fonte FX gratuita (EUR/USD); BTP/bond a inserimento manuale

## Prerequisiti (da installare sulla macchina di sviluppo)
- Node.js (LTS) e npm
- Angular CLI
- Rust + toolchain Tauri 2 (per il build desktop/mobile) — vedi requisiti su tauri.app
- Un progetto **Firebase** gratuito con Firestore e Authentication (email/password) abilitati
- Una **API key Finnhub** gratuita
- **Claude Code** installato (`npm i -g @anthropic-ai/claude-code`)

## Come iniziare con Claude Code
1. Clona il repo e aprilo in Claude Code dalla cartella radice.
2. Copia `.env.example` in `.env` e compila i valori (config Firebase + API key). **Non** committare `.env`.
3. Metti il tuo Excel storico in `data/` con nome `patrimonio.xlsx` (resta fuori da git).
4. Avvia Claude Code: leggerà automaticamente `CLAUDE.md` e i documenti in `docs/`.
5. Chiedi a Claude Code di partire dalla **Fase 0** (vedi `docs/03-roadmap.md`): leggerà l'Excel, proporrà lo schema dati e attenderà la tua conferma prima di scrivere codice.

## Struttura del repository
```
.
├── CLAUDE.md                 # istruzioni lette automaticamente da Claude Code
├── README.md                 # questo file
├── .gitignore
├── .env.example              # placeholder per config Firebase e API key
├── docs/                     # documentazione di progetto (specifiche)
│   ├── 00-build-prompt.md
│   ├── 01-architecture.md
│   ├── 02-data-model.md
│   ├── 03-roadmap.md
│   ├── 04-design-guidelines.md
│   └── 05-firestore-security-rules.md
└── data/                     # qui va l'Excel (gitignorato)
    └── README.md
```

## Principi guida
- Sviluppo **incrementale**: una fase alla volta, con conferma esplicita tra una e l'altra.
- **Gratuito al 100%**: nessun servizio a pagamento, niente Cloud Functions.
- **Privacy**: i dati finanziari (Excel, `.env`) non entrano mai in git.
