/** Intestatario di una voce del patrimonio: i due membri del nucleo o le voci condivise. */
export type Owner = 'antonio' | 'michela' | 'shared';

export const OWNERS: readonly Owner[] = ['antonio', 'michela', 'shared'] as const;

export const OWNER_LABELS: Record<Owner, string> = {
  antonio: 'Antonio',
  michela: 'Michela',
  shared: 'Condiviso',
};
