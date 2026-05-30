import { AssetClass } from './asset-class';
import { Owner } from './owner';

/**
 * Foto mensile del patrimonio: lo "storico" che sostituisce l'Excel.
 * Pensato per essere precompilato dallo snapshot del mese precedente e
 * modificato nei pochi valori manuali.
 */
export interface Snapshot {
  id?: string;
  /** Riferimento mensile (fine mese). */
  date: Date;
  /** Valore per voce/account al momento dello snapshot, in EUR: { accountId: importo }. */
  values: Record<string, number>;
  /** Patrimonio netto totale in EUR (somma asset − passività). */
  netWorth: number;
  /** Ripartizione per intestatario (calcolata). */
  byOwner?: Partial<Record<Owner, number>>;
  /** Ripartizione per classe di asset (calcolata). */
  byAssetClass?: Partial<Record<AssetClass, number>>;
  /** Tasso di risparmio del mese, se disponibile (0..1). */
  savingRate?: number;
  notes?: string;
}

/** Chiave mese in formato YYYY-MM, usata come id documento per evitare duplicati. */
export function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
