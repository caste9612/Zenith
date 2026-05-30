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
- **QuoteProvider:** astrazione (strategy pattern) che recupera le quotazioni da una fonte (es. Finnhub per azioni/ETF, FX per i cambi).
- **Staleness (anzianità quota):** soglia oltre la quale, all'avvio, una quotazione in cache viene riaggiornata; serve a limitare le chiamate alle API.
- **Valuta base:** EUR. Strumenti in altra valuta vengono convarti al cambio corrente.
- **BTP / titoli di Stato italiani:** strumenti a **prezzo manuale** (nessuna API gratuita affidabile), con data dell'ultimo aggiornamento.
- **Refresh quotazioni:** aggiornamento dei prezzi all'apertura dell'app e tramite pulsante manuale (mai in streaming).
