import { Injectable, Signal, inject } from '@angular/core';
import { collection, doc, getDoc, limit, orderBy, setDoc } from 'firebase/firestore';
import {
  AccessLogEntry,
  Account,
  AppSettings,
  CashFlowMonth,
  DEFAULT_SETTINGS,
  Holding,
  Instrument,
  PortfolioHistoryPoint,
  RealizedTrade,
  Snapshot,
  Transaction,
} from '../models';
import { AuthService } from '../auth/auth.service';
import { FirebaseService } from '../firebase/firebase';
import { isTauri } from '../platform/tauri';
import { BaseRepository, entityConverter } from './firestore';

@Injectable({ providedIn: 'root' })
export class AccountsRepository extends BaseRepository<Account> {
  protected readonly collectionName = 'accounts';
  /** Voci in ordine di visualizzazione. */
  listOrdered(): Promise<Account[]> {
    return this.list(orderBy('order', 'asc'));
  }
  /** Voci in tempo reale, ordinate (chiamare in un contesto di injection). */
  connectOrdered(): Signal<Account[]> {
    return this.connect(orderBy('order', 'asc'));
  }
}

@Injectable({ providedIn: 'root' })
export class SnapshotsRepository extends BaseRepository<Snapshot> {
  protected readonly collectionName = 'snapshots';
  /** Storico in ordine cronologico. */
  listByDate(): Promise<Snapshot[]> {
    return this.list(orderBy('date', 'asc'));
  }
  /** Storico in tempo reale, ordine cronologico (chiamare in un contesto di injection). */
  connectByDate(): Signal<Snapshot[]> {
    return this.connect(orderBy('date', 'asc'));
  }
}

@Injectable({ providedIn: 'root' })
export class InstrumentsRepository extends BaseRepository<Instrument> {
  protected readonly collectionName = 'instruments';
}

@Injectable({ providedIn: 'root' })
export class PortfolioHistoryRepository extends BaseRepository<PortfolioHistoryPoint> {
  protected readonly collectionName = 'portfolioHistory';
  /** Storico mensile in tempo reale, ordine cronologico (chiamare in un contesto di injection). */
  connectByDate(): Signal<PortfolioHistoryPoint[]> {
    return this.connect(orderBy('date', 'asc'));
  }
}

@Injectable({ providedIn: 'root' })
export class RealizedTradesRepository extends BaseRepository<RealizedTrade> {
  protected readonly collectionName = 'realizedTrades';
  /** Operazioni chiuse in tempo reale, dalla più recente (chiamare in un contesto di injection). */
  connectByDate(): Signal<RealizedTrade[]> {
    return this.connect(orderBy('date', 'desc'));
  }
}

@Injectable({ providedIn: 'root' })
export class CashFlowRepository extends BaseRepository<CashFlowMonth> {
  protected readonly collectionName = 'cashFlow';
  /** Flusso mensile in tempo reale, ordine cronologico (chiamare in un contesto di injection). */
  connectByDate(): Signal<CashFlowMonth[]> {
    return this.connect(orderBy('date', 'asc'));
  }
}

/**
 * Registro accessi (users/{uid}/accessLog): una voce per login con credenziali.
 * Sola visibilità per l'utente (rilevamento manuale di accessi insoliti).
 */
@Injectable({ providedIn: 'root' })
export class AccessLogRepository extends BaseRepository<AccessLogEntry> {
  protected readonly collectionName = 'accessLog';

  /** Accessi più recenti in tempo reale (chiamare in un contesto di injection). */
  connectRecent(n = 8): Signal<AccessLogEntry[]> {
    return this.connect(orderBy('at', 'desc'), limit(n));
  }

  /**
   * Registra l'accesso corrente. Best-effort: non blocca né fa fallire il login.
   * Usa `currentUser` (disponibile subito dopo il sign-in) invece del Signal di auth,
   * che viene aggiornato in modo asincrono da onAuthStateChanged.
   */
  async record(): Promise<void> {
    try {
      const uid = this.fb.auth.currentUser?.uid;
      if (!uid) return;
      const entry: AccessLogEntry = {
        at: new Date(),
        platform: isTauri() ? 'desktop' : 'web',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      };
      const ref = doc(
        collection(this.fb.db, 'users', uid, 'accessLog').withConverter(
          entityConverter<AccessLogEntry>(),
        ),
      );
      await setDoc(ref, { ...entry, id: ref.id });
    } catch {
      /* best-effort: il registro accessi non deve mai bloccare il login */
    }
  }
}

@Injectable({ providedIn: 'root' })
export class HoldingsRepository extends BaseRepository<Holding> {
  protected readonly collectionName = 'holdings';
  /** Posizioni in tempo reale (chiamare in un contesto di injection). */
  connectAll(): Signal<Holding[]> {
    return this.connect();
  }
}

@Injectable({ providedIn: 'root' })
export class TransactionsRepository extends BaseRepository<Transaction> {
  protected readonly collectionName = 'transactions';
  listByDate(): Promise<Transaction[]> {
    return this.list(orderBy('date', 'desc'));
  }
  /** Movimenti in tempo reale, dal più recente (chiamare in un contesto di injection). */
  connectByDate(): Signal<Transaction[]> {
    return this.connect(orderBy('date', 'desc'));
  }
}

/** Preferenze: documento singolo in users/{uid}/settings/app. */
@Injectable({ providedIn: 'root' })
export class SettingsRepository {
  private readonly fb = inject(FirebaseService);
  private readonly auth = inject(AuthService);
  private readonly converter = entityConverter<AppSettings & { id?: string }>();

  private ref() {
    const uid = this.auth.uid();
    if (!uid) throw new Error('Utente non autenticato.');
    return doc(this.fb.db, 'users', uid, 'settings', 'app').withConverter(this.converter);
  }

  async get(): Promise<AppSettings> {
    const snap = await getDoc(this.ref());
    return snap.exists() ? snap.data() : { ...DEFAULT_SETTINGS };
  }

  async save(settings: AppSettings): Promise<void> {
    await setDoc(this.ref(), settings, { merge: true });
  }
}
