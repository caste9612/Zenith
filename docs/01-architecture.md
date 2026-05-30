# 01 — Architettura e decisioni tecniche

## Stack scelto
- **Frontend:** Angular (ultima LTS), TypeScript, standalone components, **Signals** per lo stato.
- **Backend:** Firebase piano **Spark** (gratuito) → **Firestore** (dati) + **Firebase Auth** (email/password). Persistenza offline abilitata.
- **Packaging:** **Tauri 2**, per generare l'eseguibile **Windows** e l'**APK Android** dalla stessa app web.

## Perché questo stack
- **Firebase è il vincolo dato.** L'SDK JavaScript di Firebase è l'unico maturo e identico su tutte le piattaforme (web, desktop via webview, Android). Questo evita il punto debole di altri approcci (es. Flutter, dove il supporto Firestore/Auth su Windows desktop è ancora incompleto).
- **Angular** è la competenza più forte del committente: produttività immediata e manutenibilità nel tempo.
- **Tauri 2 + plugin HTTP** risolve il nodo delle quotazioni: nel browser molte API finanziarie sono bloccate dalla CORS, ma le chiamate fatte dal layer nativo di Tauri sono **dirette, senza CORS**, sia su Windows sia su Android. Così non serve un proxy/server (= niente Cloud Functions = si resta gratis).
- Se il target **Android con Tauri** dovesse dare attrito, fallback documentato: **Capacitor** per il solo Android (Angular resta invariato).

## Vincolo "gratuito"
- Piano **Spark**: nessun metodo di pagamento richiesto. I limiti giornalieri di Firestore (decine di migliaia di letture/scritture al giorno) sono enormemente sopra il fabbisogno di un'app personale a utente singolo.
- **Niente Cloud Functions** (richiederebbero il piano Blaze). Ogni elaborazione è lato client.

## Strategia quotazioni
- **Nessuno streaming.** Refresh solo all'apertura dell'app e su pulsante manuale.
- Ogni quotazione è salvata in Firestore (`lastPrice`, `lastPriceAt`). All'avvio si rifà la fetch **solo se** la quota supera una soglia di anzianità configurabile (es. sessione di mercato). Questo minimizza le chiamate e sincronizza i due dispositivi.
- Astrazione **`QuoteProvider`** (strategy pattern) per cambiare/aggiungere fonti senza toccare il resto.
  - **Finnhub** (free tier ~60 chiamate/min): azioni/ETF.
  - **FX gratuita** (es. Frankfurter / dati BCE, senza chiave): EUR/USD e altri cambi.
  - **BTP / titoli di Stato italiani**: non esiste un'API gratuita affidabile → **valore manuale** per posizione, con data di aggiornamento. Il modello deve permettere di aggiungere in futuro una fonte dedicata senza refactoring.

## Multivaluta
Valuta base **EUR**. Gli strumenti in altra valuta (es. USD) sono convertiti al cambio corrente recuperato dal provider FX.
