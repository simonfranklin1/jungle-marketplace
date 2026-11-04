import { z } from 'zod'
import { CATEGORIES, NETWORKS, SORTS, TABS, type NftListQuery } from '@/api/types'

const ids = <T extends readonly { id: string }[]>(list: T) => list.map((x) => x.id) as unknown as [T[number]['id'], ...T[number]['id'][]]
// preços como número na URL (?priceMin=1.5) e string decimal na API
const price = z.coerce.number().min(0).max(1000)

/**
 * Estado do catálogo vive na URL. Valores inválidos são descartados (.catch) para que
 * links quebrados/antigos nunca derrubem a página.
 */
export const catalogSearchSchema = z.object({
  q: z.coerce.string().trim().min(1).max(80).optional().catch(undefined),
  category: z.enum(ids(CATEGORIES)).optional().catch(undefined),
  network: z.enum(ids(NETWORKS)).optional().catch(undefined),
  priceMin: price.optional().catch(undefined),
  priceMax: price.optional().catch(undefined),
  tab: z.enum(ids(TABS)).optional().catch(undefined),
  sort: z.enum(ids(SORTS)).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
})

export type CatalogSearch = z.infer<typeof catalogSearchSchema>

export function toListQuery(s: CatalogSearch): NftListQuery {
  return {
    ...s,
    priceMin: s.priceMin !== undefined ? s.priceMin.toFixed(2) : undefined,
    priceMax: s.priceMax !== undefined ? s.priceMax.toFixed(2) : undefined,
    page: s.page ?? 1,
  }
}
