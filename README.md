# Zenith

App personale (utente singolo) per tracciare **patrimonio netto** e **portafoglio titoli**, in sostituzione di un Excel storico. Gira su **Windows** (desktop) e **Android** dalla stessa codebase, e come **web app/PWA**.

## Stack
- **Frontend:** Angular 20 (standalone, **Signals**, change detection **zoneless**, OnPush)
- **Backend:** Firebase — Firestore + Authentication (piano gratuito **Spark**), offline abilitato, letture realtime
- **Packaging:** Tauri 2 (eseguibile Windows + APK Android) · plugin HTTP per le API di mercato (niente CORS)
- **Quotazioni:** Finnhub (azioni/ETF) + FX gratuita (Frankfurter); BTP/bond a inserimento manuale

> Performance e reattività sono un requisito di prima classe: vedi `docs/07-performance.md`.

## Requisiti
- Node.js LTS + npm
- Un progetto **Firebase** gratuito (Firestore + Auth email/password)
- *(opzionale)* API key **Finnhub** per le quotazioni
- *(solo per build desktop/mobile)* Rust + toolchain Tauri 2

## Avvio rapido
```bash
npm install
cp .env.example .env          # poi compila i valori (config Firebase)
npm start                     # http://localhost:4200
```
La config Firebase **non** sta nel repo: va in `.env` (gitignorato) e viene iniettata a build-time
in `src/environments/firebase-config.ts` (rigenerato a ogni `start`/`build`).

## Comandi
| Comando | Cosa fa |
|---|---|
| `npm start` | Dev server (genera la config + `ng serve`) |
| `npm run build` | Build di produzione in `dist/zenith/browser` |
| `npm test` | Unit test (Karma/Jasmine) |
| `npm run import:parse` | Legge l'Excel storico → `data/seed.json` (locale, gitignorato) |
| `npm run import:seed` | Carica `seed.json` su Firestore (login con `SEED_EMAIL/SEED_PASSWORD`) |
| `npm run deploy:rules` | Deploy regole + indici Firestore |
| `npm run deploy:hosting` | Build + deploy su Firebase Hosting |
| `npm run tauri:dev` / `tauri:build` | App desktop/Android (richiede Rust) |

## Import dello storico
1. Metti il tuo Excel in root (`Balance Sheet.xlsx`) o in `data/` — resta **fuori da git**.
2. `npm run import:parse` → genera `data/seed.json` e stampa un riepilogo dei dati estratti.
3. `npm run import:seed` → crea l'utente (se serve) e scrive i dati sotto `users/{uid}/…`.

## Struttura
```
.
├── CLAUDE.md                 # "costituzione" del progetto (letta da Claude Code)
├── docs/                     # 00..07 — specifiche, architettura, roadmap, design, performance…
├── data/                     # Excel + seed.json (gitignorati); solo README versionato
├── scripts/
│   ├── generate-firebase-config.mjs   # .env → src/environments/firebase-config.ts
│   └── import/                         # parse-excel.mjs, seed-firestore.mjs
├── src/
│   ├── environments/         # environment.ts (+ firebase-config.ts generato)
│   ├── styles/               # design system: _tokens, _base, _utilities
│   └── app/
│       ├── core/             # auth, data (Firestore), firebase, models, money, platform, quotes, theme
│       └── features/         # dashboard, portfolio, snapshots, settings, auth
├── src-tauri/                # guscio Tauri (desktop/Android)
├── firebase.json · firestore.rules · firestore.indexes.json · .firebaserc
└── angular.json · tsconfig*.json · package.json
```

## Privacy
- I **dati finanziari** (Excel, `data/*.json`) e i **segreti** (`.env`) non entrano mai in git.
- Le security rules isolano i dati per utente (`users/{uid}`).

## Principi
- Sviluppo **incrementale** a fasi, con conferma tra una e l'altra (vedi `docs/03-roadmap.md`).
- **Gratuito al 100%**: piano Spark, nessuna Cloud Function, logica lato client.
