# 05 — Regole di sicurezza Firestore

App a **utente singolo**, ma le regole devono comunque garantire che ogni utente acceda **solo ai propri dati**. Tutti i documenti stanno sotto `users/{uid}/...`.

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
- Il file definitivo va versionato come `firestore.rules` nella root del progetto e deployato con la Firebase CLI (`firebase deploy --only firestore:rules`).
- In Fase 1, valutare regole di validazione più strette (campi obbligatori, enum di `type`/`assetType`, numeri non negativi dove sensato).
- Definire anche gli **indici** Firestore necessari alle query (es. transazioni per data, snapshot per mese) e versionarli in `firestore.indexes.json`.
