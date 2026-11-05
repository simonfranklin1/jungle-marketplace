import type { Edition } from '@/api/types'

const EDITION_PREFERENCE = ['1-50', '1-10', 'open', '1-1']

/** Edição sugerida por padrão: 1/50 (como no Figma) ou a próxima com estoque. */
export function pickDefaultEdition(editions: Edition[]) {
  const byPref = [...editions].sort((a, b) => EDITION_PREFERENCE.indexOf(a.id) - EDITION_PREFERENCE.indexOf(b.id))
  return byPref.find((e) => e.available > 0) ?? editions[0]
}
