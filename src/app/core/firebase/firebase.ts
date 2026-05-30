import { Injectable } from '@angular/core';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import {
  Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { environment } from '../../../environments/environment';

/**
 * Punto unico di inizializzazione del Firebase SDK modulare.
 * - Firestore con cache persistente (offline abilitato, vedi CLAUDE.md).
 * - Auth con persistenza locale (sopravvive ai riavvii, anche nella webview Tauri).
 * L'inizializzazione è pigra e protetta: se `.env` non è configurato, l'accesso a
 * app/db/auth lancia un errore chiaro e l'app mostra lo stato "da configurare".
 */
@Injectable({ providedIn: 'root' })
export class FirebaseService {
  /** true se i valori essenziali di Firebase sono presenti in .env. */
  readonly configured = environment.firebaseConfigured;

  private _app?: FirebaseApp;
  private _auth?: Auth;
  private _db?: Firestore;

  get app(): FirebaseApp {
    if (!this.configured) {
      throw new Error('Firebase non configurato: copia .env.example in .env e compila i valori.');
    }
    if (!this._app) {
      this._app = getApps().length ? getApps()[0] : initializeApp({ ...environment.firebase });
    }
    return this._app;
  }

  get db(): Firestore {
    if (!this._db) {
      this._db = initializeFirestore(this.app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    }
    return this._db;
  }

  get auth(): Auth {
    if (!this._auth) {
      this._auth = getAuth(this.app);
      void setPersistence(this._auth, browserLocalPersistence);
    }
    return this._auth;
  }
}
