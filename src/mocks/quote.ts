import type { CartItem, Network, Quote, QuoteIssue, QuoteLine } from '@/api/types'
import { addEth, compareEth, mulEth, percentEth, subEth } from '@/lib/eth'
import { findNft } from './db'
import { is } from './scenario'

export const NETWORK_FEES: Record<Network, string> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.001',
}

interface CouponRule {
  percent: number
  minSubtotal?: string
  expired?: boolean
}

/** Cupons fictícios documentados no README. */
export const COUPONS: Record<string, CouponRule> = {
  KURIO10: { percent: 10 },
  GENESIS20: { percent: 20, minSubtotal: '2' },
  EXPIRADO: { percent: 15, expired: true },
}

export type CouponCheck = { ok: true; code: string; percent: number } | { ok: false; message: string; transient?: boolean }

export function checkCoupon(raw: string, subtotal: string): CouponCheck {
  const code = raw.trim().toUpperCase()
  if (is('coupon-error')) return { ok: false, transient: true, message: 'Serviço de cupons indisponível. Tente novamente.' }
  const rule = COUPONS[code]
  if (!rule) return { ok: false, message: 'Cupom inválido.' }
  if (rule.expired) return { ok: false, message: 'Este cupom expirou.' }
  if (rule.minSubtotal && compareEth(subtotal, rule.minSubtotal) < 0)
    return { ok: false, message: `Este cupom exige subtotal mínimo de ${rule.minSubtotal} ETH.` }
  return { ok: true, code, percent: rule.percent }
}

export function normalizeItems(items: unknown): CartItem[] | null {
  if (!Array.isArray(items)) return null
  const out: CartItem[] = []
  for (const it of items) {
    if (!it || typeof it !== 'object') return null
    const { nftId, editionId, quantity } = it as Record<string, unknown>
    if (typeof nftId !== 'string' || typeof editionId !== 'string') return null
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return null
    const existing = out.find((o) => o.nftId === nftId && o.editionId === editionId)
    if (existing) existing.quantity += quantity
    else out.push({ nftId, editionId, quantity })
  }
  return out
}

export function computeQuote(items: CartItem[], coupon: string | null, network: Network = 'ethereum'): Quote {
  const lines: QuoteLine[] = []
  const issues: QuoteIssue[] = []
  for (const item of items) {
    const nft = findNft(item.nftId)
    if (!nft) {
      issues.push({ type: 'NOT_FOUND', nftId: item.nftId })
      continue
    }
    const edition = nft.editions.find((e) => e.id === item.editionId)
    if (!edition) {
      issues.push({ type: 'NOT_FOUND', nftId: item.nftId })
      continue
    }
    const available = Math.min(edition.available, nft.maxPerOrder)
    if (item.quantity > edition.available)
      issues.push({ type: 'UNAVAILABLE', nftId: nft.id, editionId: edition.id, available: edition.available })
    lines.push({
      nftId: nft.id,
      editionId: edition.id,
      editionLabel: edition.label,
      name: nft.name,
      tokenId: nft.tokenId,
      thumb: nft.thumb,
      unitPriceEth: nft.priceEth,
      quantity: item.quantity,
      lineTotalEth: mulEth(nft.priceEth, item.quantity),
      available,
    })
  }
  const subtotal = lines.length ? addEth(...lines.map((l) => l.lineTotalEth)) : '0.00'
  let discount = '0.00'
  let appliedCoupon: Quote['coupon'] = null
  let couponError: string | null = null
  if (coupon) {
    const check = checkCoupon(coupon, subtotal)
    if (check.ok) {
      appliedCoupon = { code: check.code, percent: check.percent }
      discount = percentEth(subtotal, check.percent)
    } else couponError = check.message
  }
  const fee = lines.length ? NETWORK_FEES[network] : '0.00'
  return {
    lines,
    subtotalEth: subtotal,
    discountEth: discount,
    networkFeeEth: fee,
    totalEth: addEth(subEth(subtotal, discount), fee),
    coupon: appliedCoupon,
    couponError,
    issues,
    network,
  }
}
