import { DestroyRef, inject, Signal, signal } from '@angular/core';
import { DocumentReference, onSnapshot, Query } from 'firebase/firestore';

/**
 * Bridge tra una query Firestore in tempo reale (onSnapshot) e un Signal Angular.
 *
 * Realtime + cache offline = UI sempre fresca e reattiva (anche tra desktop e mobile):
 * il valore arriva dalla cache locale all'istante e si aggiorna in background alla sync.
 * In change detection zoneless, l'aggiornamento del Signal ridisegna solo ciò che dipende
 * da quel dato — niente cicli globali.
 *
 * NB: chiamare in un contesto di injection (campo/costruttore di un componente o servizio):
 * il listener viene chiuso automaticamente alla distruzione (DestroyRef).
 */
export function collectionSignal<T>(query: Query<T>, initial: T[] = []): Signal<T[]> {
  const state = signal<T[]>(initial);
  const unsubscribe = onSnapshot(query, (snap) => state.set(snap.docs.map((d) => d.data())));
  inject(DestroyRef).onDestroy(unsubscribe);
  return state.asReadonly();
}

/** Variante per un singolo documento. */
export function docSignal<T>(ref: DocumentReference<T>, initial: T | null = null): Signal<T | null> {
  const state = signal<T | null>(initial);
  const unsubscribe = onSnapshot(ref, (snap) => state.set(snap.exists() ? snap.data() : null));
  inject(DestroyRef).onDestroy(unsubscribe);
  return state.asReadonly();
}
