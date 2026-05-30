import { inject, Signal } from '@angular/core';
import {
  collection,
  CollectionReference,
  deleteDoc,
  doc,
  DocumentData,
  FirestoreDataConverter,
  getDocs,
  query,
  QueryConstraint,
  QueryDocumentSnapshot,
  setDoc,
  Timestamp,
  WithFieldValue,
} from 'firebase/firestore';
import { AuthService } from '../auth/auth.service';
import { FirebaseService } from '../firebase/firebase';
import { collectionSignal } from './reactive';

// --- conversione ricorsiva Date <-> Timestamp -------------------------------

function deepToFirestore(value: unknown): unknown {
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (Array.isArray(value)) return value.map(deepToFirestore);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue; // Firestore non accetta undefined
      out[k] = deepToFirestore(v);
    }
    return out;
  }
  return value;
}

function deepFromFirestore(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(deepFromFirestore);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepFromFirestore(v);
    }
    return out;
  }
  return value;
}

/** Converter generico che mappa i campi Date su Timestamp (e viceversa) e gestisce l'id. */
export function entityConverter<T extends { id?: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore(model: WithFieldValue<T>): DocumentData {
      const rest = { ...(model as Record<string, unknown>) };
      delete rest['id'];
      return deepToFirestore(rest) as DocumentData;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): T {
      const data = deepFromFirestore(snapshot.data()) as Record<string, unknown>;
      return { ...data, id: snapshot.id } as unknown as T;
    },
  };
}

// --- repository base ---------------------------------------------------------

/**
 * CRUD di base su una sottocollezione dell'utente: users/{uid}/{collectionName}.
 * L'isolamento per utente è garantito anche dalle security rules (vedi firestore.rules).
 */
export abstract class BaseRepository<T extends { id?: string }> {
  protected readonly fb = inject(FirebaseService);
  protected readonly auth = inject(AuthService);
  protected abstract readonly collectionName: string;
  private readonly converter = entityConverter<T>();

  protected col(): CollectionReference<T> {
    const uid = this.auth.uid();
    if (!uid) throw new Error('Utente non autenticato.');
    return collection(this.fb.db, 'users', uid, this.collectionName).withConverter(this.converter);
  }

  async list(...constraints: QueryConstraint[]): Promise<T[]> {
    const snap = await getDocs(query(this.col(), ...constraints));
    return snap.docs.map((d) => d.data());
  }

  /**
   * Lettura REATTIVA in tempo reale (onSnapshot → Signal): la UI si aggiorna da sola.
   * Chiamare in un contesto di injection (campo/costruttore di componente o feature service).
   */
  connect(...constraints: QueryConstraint[]): Signal<T[]> {
    return collectionSignal(query(this.col(), ...constraints));
  }

  /** Crea (id auto) o aggiorna (id presente) un documento; ritorna l'id. */
  async upsert(item: T): Promise<string> {
    const ref = item.id ? doc(this.col(), item.id) : doc(this.col());
    await setDoc(ref, { ...item, id: ref.id }, { merge: true });
    return ref.id;
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.col(), id));
  }
}
