import { CATEGORIES, NETWORKS, type Category, type Edition, type Network, type Nft } from '@/api/types'

/** PRNG determinístico: o catálogo é sempre o mesmo para testes e screenshots. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Art = 'emerald' | 'sage' | 'ivory' | 'golden'

const ART_ATTRS: Record<Art, string[]> = {
  emerald: ['Óculos', 'Esmeralda', 'Jaqueta college'],
  sage: ['Chapéu bucket', 'Moletom', 'Sereno'],
  ivory: ['Gola alta', 'Blazer', 'Brinco'],
  golden: ['Fones', 'Juba dourada', 'Groove'],
}

/** NFTs que aparecem no Figma, na mesma ordem. */
const FEATURED: Array<{ name: string; art: Art; price: string; prev?: string; rare?: boolean }> = [
  { name: 'Emerald Ape #042', art: 'emerald', price: '1.19' },
  { name: 'Sage Nomad #009', art: 'sage', price: '1.69' },
  { name: 'Neon Vessel #552', art: 'ivory', price: '1.99', prev: '2.29', rare: true },
  { name: 'Cosmic Bloom #118', art: 'sage', price: '1.29' },
  { name: 'Violet Nomad #314', art: 'sage', price: '1.39' },
  { name: 'Ivory Baron #088', art: 'ivory', price: '1.79' },
  { name: 'Golden Beat #207', art: 'golden', price: '0.99' },
  { name: 'Golden Frequency #071', art: 'golden', price: '0.59' },
  { name: 'Golden Signal #160', art: 'golden', price: '0.39' },
]

const PREFIX: Record<Art, string[]> = {
  emerald: ['Emerald', 'Jade', 'Verdant', 'Forest'],
  sage: ['Sage', 'Lilac', 'Misty', 'Velvet'],
  ivory: ['Ivory', 'Onyx', 'Noir', 'Marble'],
  golden: ['Golden', 'Amber', 'Honey', 'Solar'],
}
const SUFFIX: Record<Art, string[]> = {
  emerald: ['Ape', 'Chief', 'Shades', 'Varsity'],
  sage: ['Nomad', 'Drifter', 'Bloom', 'Wanderer'],
  ivory: ['Baron', 'Vessel', 'Duke', 'Count'],
  golden: ['Beat', 'Signal', 'Wave', 'Rhythm'],
}
const ARTS: Art[] = ['emerald', 'sage', 'ivory', 'golden']

export const SEED_NOW = Date.parse('2026-11-01T12:00:00Z')
export const TOTAL_NFTS = 45

export interface NftRecord extends Nft {
  trendingScore: number
}

function makeEditions(rand: () => number, soldOut: boolean): Edition[] {
  const pick = (max: number) => (soldOut ? 0 : Math.max(0, Math.floor(rand() * (max + 1))))
  return [
    { id: '1-1', label: '1/1', supply: 1, available: soldOut ? 0 : rand() > 0.5 ? 1 : 0 },
    { id: '1-10', label: '1/10', supply: 10, available: pick(10) },
    { id: '1-50', label: '1/50', supply: 50, available: soldOut ? 0 : 5 + Math.floor(rand() * 45) },
    { id: 'open', label: 'Aberta', supply: null, available: soldOut ? 0 : 999 },
  ]
}

export function buildCatalog(): NftRecord[] {
  const rand = mulberry32(42)
  const out: NftRecord[] = []
  for (let i = 0; i < TOTAL_NFTS; i++) {
    const f = FEATURED[i]
    const art: Art = f?.art ?? ARTS[i % ARTS.length]
    let name: string
    let price: string
    if (f) {
      name = f.name
      price = f.price
    } else {
      const num = String(100 + Math.floor(rand() * 899)).padStart(3, '0')
      name = `${PREFIX[art][Math.floor(rand() * 4)]} ${SUFFIX[art][Math.floor(rand() * 4)]} #${num}`
      // distribuição concentrada em preços baixos, faixa 0.02 – 12.30 ETH (como no Figma)
      price = (0.02 + rand() ** 2 * 12.28).toFixed(2)
    }
    const tokenNum = name.split('#')[1] ?? String(i)
    const category: Category = i === 0 ? 'arte-digital' : CATEGORIES[Math.floor(rand() * CATEGORIES.length)].id
    const network: Network = i < 9 ? 'ethereum' : NETWORKS[Math.floor(rand() * NETWORKS.length)].id
    // NFT #44 começa esgotado para cobrir o estado "indisponível"
    const soldOut = i === TOTAL_NFTS - 1
    const editions = makeEditions(rand, soldOut)
    const id = name.toLowerCase().replace(/#/g, '').replace(/\s+/g, '-')
    const createdAt = new Date(SEED_NOW - Math.floor(rand() * 90) * 86400000 - i * 3600000).toISOString()
    out.push({
      id,
      name,
      tokenId: `#${tokenNum.padStart(4, '0')}`,
      image: `/nfts/${art}.webp`,
      thumb: `/nfts/${art}-thumb.webp`,
      priceEth: price,
      previousPriceEth: f?.prev ?? null,
      rarity: f?.rare || (!f && rand() > 0.85) ? 'raro' : null,
      category,
      network,
      available: editions.reduce((a, e) => a + e.available, 0),
      version: 1,
      collection: 'Kurio Apes',
      description:
        'Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.',
      details: `${name} é uma obra digital finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na rede. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.\n\nA propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. O criador recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.`,
      attributes: [...ART_ATTRS[art].slice(0, 2), rand() > 0.6 ? 'Raro' : 'Comum'],
      editions,
      rating: 4 + Math.round(rand() * 10) / 10,
      reviewsCount: 3 + Math.floor(rand() * 40),
      contract: `0x7A42${Math.floor(rand() * 0xffff).toString(16).toUpperCase().padStart(4, '0')}...19E8`,
      royaltiesPercent: 5,
      maxPerOrder: 10,
      createdAt,
      trendingScore: Math.floor(rand() * 100),
    })
  }
  return out
}
