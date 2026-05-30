/**
 * Classe di asset di una voce del patrimonio. Deriva dalle colonne dell'Excel
 * (Azionario, Crypto, F.Pensione, Cash, Riserva, F.Emergenza, Cassa Famiglia…)
 * più alcune classi previste per il futuro (immobili, veicoli, passività).
 */
export type AssetClass =
  | 'equity' // Azionario / investimenti in titoli
  | 'crypto' // Criptovalute
  | 'pension' // Fondo pensione
  | 'cash' // Liquidità / conti
  | 'reserve' // Riserva
  | 'emergency' // Fondo emergenza
  | 'realEstate' // Immobili
  | 'vehicle' // Veicoli (auto)
  | 'liability' // Passività (es. mutuo)
  | 'other';

export const ASSET_CLASSES: readonly AssetClass[] = [
  'equity',
  'crypto',
  'pension',
  'cash',
  'reserve',
  'emergency',
  'realEstate',
  'vehicle',
  'liability',
  'other',
] as const;

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equity: 'Azionario',
  crypto: 'Crypto',
  pension: 'Fondo pensione',
  cash: 'Liquidità',
  reserve: 'Riserva',
  emergency: 'Fondo emergenza',
  realEstate: 'Immobili',
  vehicle: 'Veicoli',
  liability: 'Passività',
  other: 'Altro',
};

/** Classi che, per natura, rappresentano una passività (sottraggono al patrimonio). */
export const LIABILITY_CLASSES: readonly AssetClass[] = ['liability'] as const;
