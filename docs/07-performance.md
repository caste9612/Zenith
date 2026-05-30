# 07 — Performance e reattività

> Reattività e performance sono un **requisito di prima classe**, su desktop (WebView2) e mobile
> (Android System WebView). Questo documento fissa le decisioni e le regole da rispettare a ogni fase.
> In caso di conflitto con la comodità, **vince la performance percepita**.

## Principi
- **Tutto lo stato è in Signals.** Niente stato mutato "di nascosto": la UI reagisce solo a Signal, eventi e risoluzione di Promise/await.
- **Calcola, non memorizzare.** I valori derivati (patrimonio netto, P&L, ripartizioni) sono `computed()` — ricalcolati pigramente solo quando cambiano gli input.
- **Meno lavoro possibile al primo render.** Carica l'essenziale, rimanda il resto.

## Change detection: zoneless
- L'app gira **senza zone.js** (`provideZonelessChangeDetection()` in `app.config.ts`; `zone.js` rimosso da polyfill e dipendenze).
- La change detection scatta solo sui cambi di Signal / eventi del template → niente cicli globali, UI più fluida (decisivo su WebView mobile) e bundle più leggero.
- **Tutti i componenti sono `OnPush`** (default impostato in `angular.json` per i nuovi componenti). Conseguenza pratica: aggiornare lo stato **solo** via Signal o eventi legati al template.

## Reattività dei dati (Firestore)
- **Cache offline persistente** abilitata (`persistentLocalCache`): le letture sono servite dalla cache locale **all'istante** e sincronizzate in background.
- **Letture realtime → Signal** tramite il bridge `collectionSignal()` / `docSignal()` (`core/data/reactive.ts`) e `BaseRepository.connect()`. La UI si aggiorna da sola, anche tra desktop e mobile, senza polling.
- **Quotazioni: nessuno streaming** (vincolo di progetto): refresh all'avvio + pulsante manuale, con cache e soglia di *staleness*. Vedi `QuoteService.isStale`.
- **No query N+1.** Carica le collezioni con una query e fai il "join" in memoria (Signal/computed). Definisci gli **indici** necessari in `firestore.indexes.json` quando aggiungi query con filtro+ordinamento.

## Bundle e caricamento
- **Rotte lazy** (`loadComponent`) — già attive; ogni pagina è un chunk separato (1–3 kB l'una).
- **Preload** dei chunk dopo il primo render (`withPreloading(PreloadAllModules)`) → navigazione istantanea.
- **Transizioni di rotta** (`withViewTransitions()`): rimandate — generano errori "Transition aborted" sui redirect del guard; da riattivare con gestione esplicita dei redirect.
- **`@defer`** nei template per ciò che è pesante o sotto la piega (es. grafici): si carica/renderizza al bisogno (viewport/idle).
- **Firebase** è il pezzo più grosso del bundle iniziale (~100 kB transfer): accettabile e cache-ato. Se servirà, valutare il caricamento dinamico di Firestore separato da Auth.
- **Budget di build** definiti in `angular.json`: tenerli d'occhio a ogni fase.

## Rendering
- **Liste lunghe** (track record, transazioni): **virtual scrolling** con `@angular/cdk/scrolling` (da aggiungere quando arrivano le liste). Mai renderizzare centinaia di righe insieme.
- **`@for` con `track`** sempre, per un diffing efficiente.
- **Grafico storico**: preferire un **componente SVG leggero e su misura** (la serie del patrimonio netto è ~60 punti, una linea/area pulita) → zero dipendenze, controllo totale sullo stile, ottimo su mobile. Una libreria pesante solo se servirà interattività avanzata, e in quel caso **lazy/`@defer`**.
- Animazioni via **transform/opacity** (GPU), evitando reflow. Valutare `content-visibility: auto` per sezioni fuori schermo.
- **Numeri** con `font-variant-numeric: tabular-nums` (già nei token) per liste stabili.

## Tauri / WebView
- WebView Chromium (WebView2 / Android): CSS/JS moderni ok.
- Avvio snello: niente lavoro sincrono pesante al boot; rimandare il non essenziale.
- IPC minimale (solo il plugin HTTP per le quotazioni, senza CORS).

## Regole pratiche (do / don't)
- ✅ Stato in Signal; derivati in `computed`; effetti in `effect`.
- ✅ Letture dati reattive via `connect()` / `collectionSignal`.
- ✅ `@defer` per grafici e blocchi pesanti; virtual scroll per liste lunghe.
- ❌ Niente stato mutato fuori da Signal/eventi (in zoneless non ridisegna).
- ❌ Niente subscribe manuali senza cleanup; niente query in loop.
- ❌ Niente librerie pesanti caricate nel bundle iniziale.

## Misurazione
- Controllare le statistiche di build (dimensioni chunk) a ogni fase.
- Per analisi bundle: `source-map-explorer` sui file di `dist/` (build con source map).
- Verifiche manuali in preview (desktop e mobile) come parte della definizione di "fatto".
