# 06 — Glossario del dominio

Termini usati nel progetto, per allineare il linguaggio del codice e delle UI.

- **Patrimonio netto (net worth):** somma di tutti gli asset meno le passività, espressa in valuta base (EUR).
- **Balance sheet:** la fotografia del patrimonio (asset e passività) in un dato momento.
- **Snapshot:** registrazione **mensile** manuale dello stato del patrimonio; l'insieme degli snapshot è lo "storico" che sostituisce l'Excel.
- **Account (voce):** un elemento del patrimonio: conto bancario, fondo pensione, immobile, veicolo, liquidità, oppure una passività (es. mutuo).
- **Asset class (classe di asset):** categoria di un account/strumento (liquidità, investimenti, immobiliare, ecc.) usata per la ripartizione.
- **Instrument (strumento):** un titolo negoziabile (azione, ETF, obbligazione) con relativa anagrafica e cache della quotazione.
- **Holding (posizione):** la quantità di un certo strumento detenuta, con prezzo medio di carico.
- **Avg cost (prezzo medio di carico):** costo medio di acquisto di una posizione, base per il calcolo del P&L.
- **Transaction (movimento):** acquisto, vendita (totale o parziale), dividendo, deposito, prelievo, valorizzazione.
- **P&L (plus/minusvalenza):** guadagno o perdita di una posizione, dato dalla differenza tra valore corrente e costo di carico.
- **QuoteProvider / Fonte prezzo:** astrazione (strategy pattern) che recupera le quotazioni da una fonte impostabile **per strumento**: **Finnhub** (azioni/ETF USA), **Alpha Vantage** (mercati non-USA, dati EOD), **Yahoo** (quasi tutti i mercati, **solo app nativa Tauri** per via della CORS), **manuale**. Più il provider **FX** per i cambi. Uno strumento può avere **simboli per più provider** (`providerSymbols`) ed essere quotato da una **catena con fallback**.
- **Catena di provider / fallback:** al refresh ogni titolo prova il provider primario e poi gli altri che sanno quotarlo, in ordine *quota-friendly* (Yahoo nativo → Finnhub → Alpha Vantage); finisce tra i non aggiornati solo se falliscono tutti.
- **Ricerca titolo:** ricerca per nome/ticker su più provider (Yahoo nell'app nativa, Finnhub anche da browser) che propone candidati con simbolo, borsa e provider, per scegliere fonte e simbolo senza indovinare.
- **Staleness (anzianità quota):** soglia oltre la quale, all'avvio, una quotazione in cache viene riaggiornata; serve a limitare le chiamate alle API.
- **Valuta base:** EUR. Le quotazioni in altra valuta (es. USD) vengono **convertite in EUR** al cambio corrente prima della valorizzazione.
- **Cambio (FX):** tasso di conversione verso EUR (fonte Frankfurter/BCE, fallback open.er-api), applicato alle quote non in euro.
- **BTP / titoli di Stato italiani:** strumenti a **prezzo manuale** (nessuna API gratuita affidabile), con data dell'ultimo aggiornamento.
- **Refresh quotazioni:** aggiornamento dei prezzi all'apertura dell'app e tramite pulsante manuale (mai in streaming).
- **Costo medio (PMC):** metodo di calcolo del prezzo medio di carico dai movimenti (somma dei costi / quantità). Una vendita non lo modifica; riduce la quantità e realizza il P&L.
- **Movimento di apertura:** transazione "buy" iniziale generata dall'import che rappresenta la posizione di partenza. Le posizioni (quantità + PMC) sono **ricalcolate dai movimenti**.
- **Variazione (1g / 1m / 1a):** variazione assoluta e percentuale del valore su 1 giorno (da chiusura precedente), 1 mese e 1 anno (dallo storico mensile).
- **Benchmark:** rendimento simulato di un indice (NASDAQ/S&P) investendo lo stesso flusso netto (acquisti − vendite) del portafoglio, per confronto. Importato dall'Excel nella serie `portfolioHistory` e mostrato nella pagina **Rendimento**.
- **Track record:** storico mensile del portafoglio (valore, investito, realizzato cumulato, P/L aperto, dividendi) più i valori dei benchmark; collezione `portfolioHistory`, alimenta la pagina Rendimento.
- **Rendimento totale:** somma di plusvalenze **realizzate** (posizioni chiuse) + **dividendi** + P/L **non realizzato** (posizioni aperte); il P/L mostrato nel Portafoglio è solo la componente non realizzata.
- **Monogramma:** "logo" segnaposto di un titolo (iniziali del simbolo su sfondo colorato), in assenza di loghi reali.
- **Owner / intestatario:** a chi appartiene una voce del patrimonio: `antonio`, `michela` o `shared` (condiviso).
