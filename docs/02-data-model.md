# 02 — Modello dati (provvisorio)

> ⚠️ Questo è un punto di partenza. Lo schema **definitivo va derivato dall'Excel** in Fase 0 e confermato dal committente.

## Principio: struttura a livelli
- **Balance sheet** (livello alto): il patrimonio netto come somma di asset meno passività, con **snapshot mensili** manuali → lo "storico".
- **Portafoglio** (drill-down della voce "investimenti"): le posizioni in titoli, valorizzate con le quotazioni, che confluiscono nel totale investimenti del balance sheet.

## Isolamento per utente
Tutti i dati stanno sotto l'utente autenticato, in sottocollezioni di `users/{uid}/`. Le security rules (vedi `05`) garantiscono che ciascuno acceda solo ai propri dati.

## Collezioni (indicative)

### `users/{uid}/accounts`
Voci del patrimonio (sia asset sia passività).
- `name` (string) — es. "Conto Intesa", "Fondo pensione", "Casa", "Mutuo"
- `type` (enum) — `cash` | `pension` | `realEstate` | `vehicle` | `investment` | `liability` | `other`
- `currency` (string) — default `EUR`
- `isLiability` (bool)
- `notes` (string, opz.)

### `users/{uid}/holdings`
Posizioni in titoli (dettaglio della voce investimenti).
- `accountId` (ref) — conto/deposito di riferimento
- `instrumentId` (ref → `instruments`)
- `quantity` (number)
- `avgCost` (number) — prezzo medio di carico
- `currency` (string)
- `priceMode` (enum) — `auto` (da QuoteProvider) | `manual` (es. BTP)
- `manualPrice` (number, opz.) — usato se `priceMode = manual`

### `users/{uid}/instruments`
Anagrafica + cache quotazioni.
- `symbol` (string) — ticker (per provider auto)
- `isin` (string, opz.)
- `name` (string)
- `assetType` (enum) — `equity` | `etf` | `bond` | `fx` | `other`
- `provider` (string) — quale `QuoteProvider`
- `lastPrice` (number)
- `lastPriceAt` (timestamp)

### `users/{uid}/transactions`
Movimenti.
- `date` (timestamp)
- `type` (enum) — `buy` | `sell` | `dividend` | `deposit` | `withdraw` | `valuation`
- `holdingId` / `accountId` (ref, secondo il tipo)
- `quantity` (number, opz.) — per buy/sell (sell parziale o totale)
- `price` (number, opz.)
- `amount` (number) — importo in valuta dello strumento
- `notes` (string, opz.)

### `users/{uid}/snapshots`
Foto mensili del patrimonio (lo "storico" che sostituisce l'Excel).
- `date` (timestamp) — riferimento mensile
- `netWorth` (number, EUR)
- `byAccount` (map) — valore per conto/asset al momento dello snapshot
- `byAssetClass` (map, opz.) — ripartizione per classe
- Pensato per essere **precompilato** dallo snapshot precedente e modificato nei pochi valori manuali.

### `users/{uid}/settings`
- `baseCurrency` (string) — default `EUR`
- `quoteStalenessMinutes` (number) — soglia per il refresh all'avvio
- altre preferenze (tema, ecc.)

## Note per l'import dall'Excel
- Mappare le colonne dello storico → `snapshots` (uno per mese).
- Estrarre l'anagrafica titoli → `instruments` + `holdings`.
- Distinguere voci manuali (conti, fondo pensione) da quelle a quotazione automatica.
