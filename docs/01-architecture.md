# 01 — Architettura e decisioni tecniche

> Stato: **implementato**. Questo documento riflette le scelte effettive.

## Stack scelto
- **Frontend:** Angular **20** (standalone, **Signals**, change detection **zoneless** + OnPush), TypeScript.
- **Backend:** Firebase **12** piano **Spark** (gratuito) → **Firestore** (dati, cache offline persistente, letture realtime → Signal) + **Firebase Auth** (email/password).
- **Packaging:** **Tauri 2.11** (eseguibile Windows + APK Android dalla stessa app web). Già attiva anche come **web app/PWA** su **Firebase Hosting** (gratuito su Spark).

## Perché questo stack
- **Firebase è il vincolo dato.** L'SDK JavaScript di Firebase è l'unico maturo e identico su tutte le piattaforme (web, desktop via webview, Android). Questo evita il punto debole di altri approcci (es. Flutter, dove il supporto Firestore/Auth su Windows desktop è ancora incompleto).
- **Angular** è la competenza più forte del committente: produttività immediata e manutenibilità nel tempo.
- **Tauri 2 + plugin HTTP** risolve il nodo delle quotazioni: nel browser molte API finanziarie sono bloccate dalla CORS, ma le chiamate fatte dal layer nativo di Tauri sono **dirette, senza CORS**, sia su Windows sia su Android. Così non serve un proxy/server (= niente Cloud Functions = si resta gratis).
- Se il target **Android con Tauri** dovesse dare attrito, fallback documentato: **Capacitor** per il solo Android (Angular resta invariato).

## Vincolo "gratuito"
- Piano **Spark**: nessun metodo di pagamento richiesto. I limiti giornalieri di Firestore (decine di migliaia di letture/scritture al giorno) sono enormemente sopra il fabbisogno di un'app personale a utente singolo.
- **Niente Cloud Functions** (richiederebbero il piano Blaze). Ogni elaborazione è lato client.

## Strategia quotazioni (implementata)
- **Nessuno streaming.** Refresh solo all'avvio (se la quota è "stale") e su pulsante "Aggiorna". Cache in Firestore (`lastPrice`, `prevClose`, `lastPriceAt`); soglia di *staleness* configurabile. Questo minimizza le chiamate e sincronizza i dispositivi.
- Astrazione **`QuoteProvider`** (strategy pattern), con **fonte impostabile per singolo strumento**:
  - **Finnhub** (free): azioni/ETF **USA**, quasi-realtime (prezzo + chiusura precedente → variazione 1 giorno). Funziona dal browser (CORS ok).
  - **Alpha Vantage** (free, ~25 req/giorno): mercati **non-USA** (Euronext, Londra…), dati **EOD**. Funziona dal browser (CORS ok). Richiede chiave gratuita.
  - **Manuale**: prezzo inserito a mano (BTP/bond, titoli delistati, o mercati non coperti gratis), con data di aggiornamento.
  - **Yahoo Finance** *(pianificato)*: copre tutto gratis ma è **bloccato dalla CORS nel browser** → utilizzabile solo nell'**app nativa Tauri** (plugin HTTP, senza CORS), in futuro.
- **Attenzione CORS:** nella web app funzionano solo le fonti che inviano header CORS (Finnhub, Alpha Vantage, Frankfurter). Le altre (Yahoo) restano per l'app nativa. Niente proxy (= niente Cloud Functions = si resta gratis).

## Multivaluta (implementata)
Valuta base **EUR**. Le quotazioni in altra valuta (es. USD) vengono **convertite in EUR** al cambio corrente, recuperato al refresh, **prima della valorizzazione** (così il valore è coerente col costo di carico, in EUR). Fonte cambio: **Frankfurter** (dati BCE, dominio `frankfurter.dev`) con fallback `open.er-api.com`; entrambe senza chiave e CORS-ok.
