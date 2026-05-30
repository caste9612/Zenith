import { computed, Injectable, inject, signal } from '@angular/core';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { FirebaseService } from '../firebase/firebase';

/**
 * Stato di autenticazione (email/password) esposto via Signals.
 * App a utente singolo, ma l'auth garantisce che ogni utente veda solo i propri dati
 * (le security rules isolano per uid).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly fb = inject(FirebaseService);

  private readonly _user = signal<User | null>(null);
  private readonly _ready = signal(false);

  readonly user = this._user.asReadonly();
  /** Diventa true quando il primo stato di auth è noto (evita flicker/redirect prematuri). */
  readonly ready = this._ready.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);
  readonly uid = computed(() => this._user()?.uid ?? null);

  get configured(): boolean {
    return this.fb.configured;
  }

  private resolveReady!: () => void;
  private readonly readyPromise = new Promise<void>((resolve) => (this.resolveReady = resolve));

  constructor() {
    if (!this.fb.configured) {
      this._ready.set(true);
      this.resolveReady();
      return;
    }
    onAuthStateChanged(this.fb.auth, (u) => {
      this._user.set(u);
      if (!this._ready()) {
        this._ready.set(true);
        this.resolveReady();
      }
    });
  }

  /** Si risolve quando lo stato iniziale di auth è disponibile. */
  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.fb.auth, email, password);
  }

  async logout(): Promise<void> {
    await signOut(this.fb.auth);
  }
}
