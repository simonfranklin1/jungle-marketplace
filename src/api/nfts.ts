import { queryOptions } from '@tanstack/react-query'
import { api } from './client'
import type { Nft, NftListQuery, NftListResponse, NftSummary } from './types'

export const nftKeys = {
  all: ['nfts'] as const,
  lists: () => [...nftKeys.all, 'list'] as const,
  list: (q: NftListQuery) => [...nftKeys.lists(), q] as const,
  detail: (id: string) => [...nftKeys.all, 'detail', id] as const,
  related: (id: string) => [...nftKeys.all, 'related', id] as const,
}

export const PAGE_SIZE = 9

export function nftListQuery(q: NftListQuery) {
  const params = { ...q, pageSize: q.pageSize ?? PAGE_SIZE }
  return queryOptions({
    queryKey: nftKeys.list(params),
    queryFn: ({ signal }) => api.get<NftListResponse>('/nfts', { params, signal }).then((r) => r.data),
    staleTime: 30_000,
  })
}

export function nftDetailQuery(id: string) {
  return queryOptions({
    queryKey: nftKeys.detail(id),
    queryFn: ({ signal }) => api.get<Nft>(`/nfts/${encodeURIComponent(id)}`, { signal }).then((r) => r.data),
    staleTime: 30_000,
  })
}

export function nftRelatedQuery(id: string) {
  return queryOptions({
    queryKey: nftKeys.related(id),
    queryFn: ({ signal }) =>
      api.get<NftSummary[]>(`/nfts/${encodeURIComponent(id)}/related`, { signal }).then((r) => r.data),
    staleTime: 60_000,
  })
}
