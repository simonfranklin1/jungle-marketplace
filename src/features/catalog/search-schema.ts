import { CATEGORIES, NETWORKS, SORTS, TABS, type Category, type Network, type NftListQuery, type SortId, type TabId } from '@/api/types'

/**
 * Estado do catálogo vive na URL. Valores inválidos são descartados para que links
 * quebrados/antigos nunca derrubem a página. Validador próprio (sem dependência) para manter
 * o bundle inicial pequeno — antes era um schema zod, que pesava ~60 kB só para isso.
 */
export interface CatalogSearch {
  q?: string
  category?: Category
  network?: Network
  /** preços como número na URL (?priceMin=1.5) e string decimal na API */
  priceMin?: number
  priceMax?: number
  tab?: TabId
  sort?: SortId
  page?: number
}

const oneOf = <T extends string>(list: readonly { id: T }[], v: unknown): T | undefined =>
  typeof v === 'string' && list.some((x) => x.id === v) ? (v as T) : undefined

const num = (v: unknown, min: number, max: number, int = false): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  if (!Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) return undefined
  return n
}

export function validateCatalogSearch(raw: Record<string, unknown>): CatalogSearch {
  const q = raw.q === undefined || raw.q === null ? '' : String(raw.q).trim().slice(0, 80)
  const out: CatalogSearch = {
    q: q || undefined,
    category: oneOf(CATEGORIES, raw.category),
    network: oneOf(NETWORKS, raw.network),
    priceMin: num(raw.priceMin, 0, 1000),
    priceMax: num(raw.priceMax, 0, 1000),
    tab: oneOf(TABS, raw.tab),
    sort: oneOf(SORTS, raw.sort),
    page: num(raw.page, 1, 10_000, true),
  }
  // As chaves inválidas ficam como `undefined` EXPLÍCITO (não remover!): o TanStack Router
  // mescla a busca bruta da URL com o resultado da validação, e uma chave ausente deixaria o
  // valor inválido original (ex.: category=xyz) voltar. Ao gerar a URL, undefined é omitido.
  return out
}

export function toListQuery(s: CatalogSearch): NftListQuery {
  return {
    ...s,
    priceMin: s.priceMin !== undefined ? s.priceMin.toFixed(2) : undefined,
    priceMax: s.priceMax !== undefined ? s.priceMax.toFixed(2) : undefined,
    page: s.page ?? 1,
  }
}
