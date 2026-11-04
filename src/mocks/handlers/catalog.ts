import { delay, http, HttpResponse } from 'msw'
import {
  CATEGORIES,
  NETWORKS,
  SORTS,
  TABS,
  type Category,
  type Network,
  type Nft,
  type NftListResponse,
  type NftSummary,
} from '@/api/types'
import { compareEth, toWei } from '@/lib/eth'
import { SEED_NOW, type NftRecord } from '../data/seed'
import { db, findNft } from '../db'
import { API, apiError, flaky, latency } from '../http-utils'
import { is } from '../scenario'

const DECIMAL = /^\d+(\.\d+)?$/

export function toSummary(n: NftRecord): NftSummary {
  return {
    id: n.id,
    name: n.name,
    tokenId: n.tokenId,
    image: n.image,
    thumb: n.thumb,
    priceEth: n.priceEth,
    previousPriceEth: n.previousPriceEth,
    rarity: n.rarity,
    category: n.category,
    network: n.network,
    available: n.available,
    version: n.version,
  }
}

export function toNft(n: NftRecord): Nft {
  const { trendingScore, ...rest } = n
  return rest
}

export const catalogHandlers = [
  http.get(`${API}/nfts`, async ({ request }) => {
    if (is('timeout')) {
      await delay(15000)
    }
    await latency()
    const fail = flaky('GET /nfts')
    if (fail) return fail
    if (is('catalog-error')) return apiError('TRANSIENT', 'Catálogo indisponível no momento.')

    const url = new URL(request.url)
    const p = url.searchParams
    const q = (p.get('q') ?? '').trim().toLowerCase()
    const category = p.get('category') as Category | null
    const network = p.get('network') as Network | null
    const priceMin = p.get('priceMin')
    const priceMax = p.get('priceMax')
    const tab = p.get('tab') ?? 'all'
    const sort = p.get('sort') ?? 'recent'
    const page = Number(p.get('page') ?? '1')
    const pageSize = Number(p.get('pageSize') ?? '9')

    const fields: Record<string, string> = {}
    if (category && !CATEGORIES.some((c) => c.id === category)) fields.category = 'Categoria inválida'
    if (network && !NETWORKS.some((c) => c.id === network)) fields.network = 'Rede inválida'
    if (priceMin && !DECIMAL.test(priceMin)) fields.priceMin = 'Preço mínimo inválido'
    if (priceMax && !DECIMAL.test(priceMax)) fields.priceMax = 'Preço máximo inválido'
    if (!TABS.some((t) => t.id === tab)) fields.tab = 'Aba inválida'
    if (!SORTS.some((s) => s.id === sort)) fields.sort = 'Ordenação inválida'
    if (!Number.isInteger(page) || page < 1) fields.page = 'Página inválida'
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 48) fields.pageSize = 'Tamanho inválido'
    if (Object.keys(fields).length) return apiError('VALIDATION', 'Parâmetros inválidos.', { fields })

    const matchQ = (n: NftRecord) =>
      !q || n.name.toLowerCase().includes(q) || n.tokenId.toLowerCase().includes(q) || n.collection.toLowerCase().includes(q)
    const matchPrice = (n: NftRecord) =>
      (!priceMin || compareEth(n.priceEth, priceMin) >= 0) && (!priceMax || compareEth(n.priceEth, priceMax) <= 0)
    const matchTab = (n: NftRecord) =>
      tab === 'new'
        ? Date.parse(n.createdAt) >= SEED_NOW - 30 * 86400000
        : tab === 'trending'
          ? n.trendingScore >= 60
          : true
    const base = db.nfts.filter((n) => matchQ(n) && matchPrice(n) && matchTab(n))

    const categories = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0])) as Record<Category, number>
    base.filter((n) => !network || n.network === network).forEach((n) => (categories[n.category] += 1))
    const networks = Object.fromEntries(NETWORKS.map((c) => [c.id, 0])) as Record<Network, number>
    base.filter((n) => !category || n.category === category).forEach((n) => (networks[n.network] += 1))

    const filtered = base.filter((n) => (!category || n.category === category) && (!network || n.network === network))
    filtered.sort((a, b) => {
      switch (sort) {
        case 'price-asc':
          return compareEth(a.priceEth, b.priceEth) || a.name.localeCompare(b.name)
        case 'price-desc':
          return compareEth(b.priceEth, a.priceEth) || a.name.localeCompare(b.name)
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          if (tab === 'trending') return b.trendingScore - a.trendingScore
          return db.nfts.indexOf(a) - db.nfts.indexOf(b)
      }
    })

    const all = db.nfts.map((n) => toWei(n.priceEth))
    const min = all.reduce((a, b) => (b < a ? b : a))
    const max = all.reduce((a, b) => (b > a ? b : a))
    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const body: NftListResponse = {
      items: filtered.slice((page - 1) * pageSize, page * pageSize).map(toSummary),
      page,
      pageSize,
      total,
      totalPages,
      facets: {
        categories,
        networks,
        priceRange: {
          min: db.nfts.find((n) => toWei(n.priceEth) === min)!.priceEth,
          max: db.nfts.find((n) => toWei(n.priceEth) === max)!.priceEth,
        },
      },
    }
    return HttpResponse.json(body)
  }),

  http.get(`${API}/nfts/:id`, async ({ params }) => {
    await latency()
    const fail = flaky(`GET /nfts/${params.id}`)
    if (fail) return fail
    const nft = findNft(String(params.id))
    if (!nft) return apiError('NOT_FOUND', 'NFT não encontrado.')
    return HttpResponse.json(toNft(nft))
  }),

  http.get(`${API}/nfts/:id/related`, async ({ params }) => {
    await latency(150)
    const nft = findNft(String(params.id))
    if (!nft) return apiError('NOT_FOUND', 'NFT não encontrado.')
    const related = db.nfts.filter((n) => n.id !== nft.id && n.collection === nft.collection).slice(3, 13)
    return HttpResponse.json(related.map(toSummary))
  }),
]
