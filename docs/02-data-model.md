# 02 — Modello dati

> ⚠️ Punto di partenza derivato dall'Excel in Fase 0, ora **implementato** (vedi nota sotto).

## Stato (implementato)
Schema derivato dal foglio **Amorini** (vista **familiare**) e implementato: i tipi sono in
`src/app/core/models/`, i repository in `src/app/core/data/`. Le 10 voci (`accounts`) hanno
`owner` (`antonio` | `michela` | `shared`) e `assetClass`: Azionario, Crypto, F. Pensione (×2),
Cash, Riserva (×2), Risparmi Michela, F. Emergenza, Cassa Famiglia. Lo storico è in `snapshots`
(uno per mese), il portafoglio in `holdings` + `instruments`. Si aggiungono: `cashFlow` (flusso
mensile, **importabile e inseribile in-app**), `portfolioHistory` e `realizedTrades` (storici del
portafoglio, sola lettura), `accessLog` (registro accessi). Le sezioni seguenti restano la
descrizione di riferimento del modello.

## Principio: struttura a livelli
- **Balance sheet** (livello alto): il patrimonio netto come somma di asset meno passività, con **snapshot mensili** manuali → lo "storico".
- **Portafoglio** (drill-down della voce "investimenti"): le posizioni in titoli, valorizzate con le quotazioni, che confluiscono nel totale investimenti del balance sheet.

## Isolamento per utente
Tutti i dati stanno sotto l'utente autenticato, in sottocollezioni di `users/{uid}/`. Le security rules (vedi `05`) garantiscono che ciascuno acceda solo ai propri dati.

## Collezioni (indicative)

### `users/{uid}/accounts`
Voci del patrimonio (sia asset sia passività). *(Modello reale: `src/app/core/models/account.ts`.)*
- `name` (string) — es. "Cash", "F. Pensione Antonio", "Risparmi Michela"
- `owner` (enum) — `antonio` | `michela` | `shared`
- `assetClass` (enum) — `equity` | `crypto` | `pension` | `cash` | `reserve` | `emergency` | `realEstate` | `vehicle` | `liability` | `other`
- `isLiability` (bool) — true per le passività (sottraggono dal netto)
- `currency` (string) — default `EUR`
- `order` (number) — ordine di visualizzazione
- `active` (bool) — le voci disattivate non entrano nei nuovi snapshot (lo storico resta)
- `linkedToPortfolio` (bool, opz.) — se true il valore si precompila dal valore **live** del portafoglio (es. "Azionario")
- `notes` (string, opz.)

> Editabile in-app da **Impostazioni → Conti e voci** (`/accounts`): rinomina, riclassifica, riordina, disattiva. Es. "Risparmi Michela" è classificata `cash` (Liquidità).

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
- `symbol` (string) — ticker "canonico" (del provider primario; usato come fallback per i provider senza voce in `providerSymbols`)
- `isin` (string, opz.)
- `name` (string)
- `assetType` (enum) — `equity` | `etf` | `bond` | `fx` | `other`
- `provider` (string) — `QuoteProvider` **primario** dello strumento
- `providerSymbols` (map, opz.) — simbolo per provider quando il ticker cambia per fonte (es. `{ "yahoo": "FLOW.AS", "alphavantage": "FLOW.AMS" }`); abilita la **catena con fallback** nel `QuoteService`. Se un provider manca, si usa `symbol`.
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

### `users/{uid}/portfolioHistory`
Track record mensile del portafoglio titoli (importato dall'Excel), con confronto vs benchmark. Sola lettura; alimenta la pagina **Rendimento**. Un documento per mese (id `YYYY-MM`).
- `date` (timestamp) — fine mese
- `value` (number, EUR) — valore del portafoglio
- `invested` (number, EUR) — capitale investito netto cumulato
- `realized` (number, EUR) — plusvalenze realizzate cumulate (posizioni chiuse)
- `openPL` (number, EUR) — P/L non realizzato del mese
- `dividends` (number, EUR) — dividendi del mese
- `sp` / `nasdaq` (number, EUR) — valore simulato investendo lo stesso flusso nell'indice

### `users/{uid}/realizedTrades`
Operazioni **chiuse** storiche (importate dall'Excel): vendite e dividendi con il P/L realizzato. Sola lettura; **dettaglio** dietro al realizzato aggregato di `portfolioHistory`. Un documento per operazione (id `YYYY-MM-n`).
- `date` (timestamp) — fine mese dell'operazione
- `symbol` (string) — ticker (per i dividendi, il titolo che li ha pagati)
- `kind` (enum) — `sale` | `dividend`
- `cost` / `quantity` (number, opz.) — null per i dividendi
- `proceeds` (number) — ricavo lordo ("utile" nell'Excel)
- `pl` (number, EUR) — P/L realizzato
- `plPct` (number, opz.) — frazione (0,12 = +12%); null per i dividendi

### `users/{uid}/cashFlow`
Flusso di cassa **mensile** (foglio CashFlow dell'Excel + **inserimento manuale in-app**). Alimenta la
pagina **Cash flow**. Un documento per mese (id `YYYY-MM`). *(Per ora si riferisce ai soli redditi di
**Antonio**.)*
- `date` (timestamp) — fine mese
- `gross` (number | null, EUR) — stipendio **lordo**
- `income` (number | null, EUR) — stipendio **netto**
- `expenses` (number | null, EUR) — uscite
- `tax` (number | null, EUR) — imposte/trattenute (≈ `gross − income`)
- `saved` (number | null, EUR) — risparmio del mese (`income − expenses`)
- Scrivibile dall'import (`import:cashflow`) **e** dall'editor "Nuovo mese" (`/cashflow/new`). La
  **tassazione per anno** mostrata in pagina è `income/gross` (derivata, non salvata).

### `users/{uid}/accessLog`
**Registro accessi**: una voce a ogni login con credenziali, per rivedere gli accessi e individuare
attività insolite (rilevamento **in-app**; nessuna email lato server — vincolo Spark, vedi `05`).
Mostrato in **Impostazioni → "Accessi recenti"**.
- `at` (timestamp) — istante dell'accesso
- `platform` (string) — `desktop` (app Tauri) | `web`
- `userAgent` (string) — browser/OS, per riconoscere il dispositivo

### `users/{uid}/settings`
- `baseCurrency` (string) — default `EUR`
- `quoteStalenessMinutes` (number) — soglia per il refresh all'avvio
- altre preferenze (tema, ecc.)

## Note per l'import dall'Excel
- Mappare le colonne dello storico → `snapshots` (uno per mese).
- Estrarre l'anagrafica titoli → `instruments` + `holdings`.
- Distinguere voci manuali (conti, fondo pensione) da quelle a quotazione automatica.
- Flusso di cassa → `cashFlow` (`import:cashflow`); operazioni chiuse → `realizedTrades`
  (`import:trades`); track record → `portfolioHistory` (`import:trackrecord`); dividendi →
  `transactions` (`import:dividends`).
- Gli script di import sono **idempotenti** (id deterministici `YYYY-MM[-n]`), quindi ri-eseguibili
  quando l'Excel cambia. ⚠️ `snapshots` e `cashFlow` sono anche **modificabili in-app**: un re-import
  li **sovrascrive**, quindi rieseguilo con cautela se nel frattempo hai inserito/corretto mesi a mano.
