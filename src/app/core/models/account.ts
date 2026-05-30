import { AssetClass } from './asset-class';
import { Owner } from './owner';

/**
 * Una voce del patrimonio (un "conto" in senso ampio): conto bancario, fondo pensione,
 * riserva, cassa famiglia, oppure il contenitore "Azionario"/"Crypto" alimentato dal
 * portafoglio. Le righe dello storico (snapshot) referenziano questi account per id.
 */
export interface Account {
  id?: string;
  /** Etichetta mostrata: es. "Azionario", "F.Pensione Antonio", "Cassa Famiglia". */
  name: string;
  owner: Owner;
  assetClass: AssetClass;
  /** Valuta della voce; default EUR. */
  currency: string;
  /** true se è una passività (es. mutuo). */
  isLiability: boolean;
  /**
   * Se true, il valore di questa voce è alimentato dal portafoglio titoli (somma delle
   * holding) anziché inserito a mano. Tipico per "Azionario".
   */
  linkedToPortfolio?: boolean;
  /** Ordine di visualizzazione in liste e form di snapshot. */
  order: number;
  /** Se false, la voce non viene proposta nei nuovi snapshot mensili. */
  active: boolean;
  notes?: string;
}
