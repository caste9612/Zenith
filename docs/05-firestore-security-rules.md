# 05 — Regole di sicurezza Firestore

App a **utente singolo**, ma le regole devono comunque garantire che ogni utente acceda **solo ai propri dati**. Tutti i documenti stanno sotto `users/{uid}/...`.

> **Stato:** il file `firestore.rules` in root è **deployato** e corrisponde all'esempio sotto
> (accesso solo a `users/{uid}/**` + deny-all su tutto il resto). Copre anche le collezioni recenti
> (`cashFlow`, `realizedTrades`, `portfolioHistory`, `accessLog`) senza modifiche, perché stanno tutte
> sotto `users/{uid}/`.

## Principi
- Nessun accesso senza autenticazione.
- Un utente legge/scrive solo sotto il proprio `uid`.
- Validazioni minime sui campi possono essere aggiunte in modo incrementale (tipi/enum) man mano che lo schema si stabilizza.

## Esempio `firestore.rules`
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Tutto ciò che appartiene all'utente
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }

    // Default: nega tutto il resto
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Note
- Il file definitivo è versionato come `firestore.rules` nella root e deployato con la Firebase CLI (`firebase deploy --only firestore:rules`).
- Regole di validazione più strette (campi obbligatori, enum di `assetClass`/`assetType`, numeri non negativi) sono **valutate ma rinviate** (vedi sotto): per ora le regole controllano solo `auth.uid`.
- Definire anche gli **indici** Firestore necessari alle query (es. transazioni per data, snapshot per mese) e versionarli in `firestore.indexes.json`.

## Registro accessi (rilevamento in-app)
A ogni **login con credenziali** l'app scrive una voce in `users/{uid}/accessLog` (data, piattaforma,
user agent) e la mostra in **Impostazioni → "Accessi recenti"**, così l'utente può individuare un
accesso che non riconosce e reagire (cambiare password). È un **rilevamento che l'utente controlla**,
non un alert automatico.
- **Perché non un'email automatica:** servirebbe monitoraggio lato server (vedere i login anche ad app
  chiusa) → **Cloud Functions / piano Blaze** o servizi esterni, vietati dal vincolo "100% gratuito,
  Spark, logica lato client". Inoltre un'email lato client è inaffidabile per la sicurezza (scatta solo
  ad app aperta; un attaccante controlla il proprio client). Quindi: **escluso**.

## Hardening valutato e rinviato (decisione del committente)
Opzioni discusse per rafforzare *autenticazione e accesso ai dati*, **gratis (no Blaze)**, da fare
solo su richiesta:
- **App Check** — accetta richieste solo dalla **app genuina** (reCAPTCHA v3 web / Play Integrity
  Android), bloccando script/token rubati. Pulito sul web; sull'app desktop Tauri serve token di
  debug/provider custom.
- **Regole Firestore validate** — oltre a `auth.uid`, validare campi (tipi/enum/range) e bloccare la
  forma delle collezioni di sola lettura. Da **testare con l'emulatore** prima del deploy.
- **MFA / 2FA (TOTP)** — il più forte sul login, ma richiede **Identity Platform**: da verificare se
  resta gratis o forza Blaze (in tal caso fuori vincolo).
- **Verifica email** obbligatoria + protezione email-enumeration (impostazioni Auth, gratis).
