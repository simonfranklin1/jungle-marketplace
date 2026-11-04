import type { Nft, Order } from '@/api/types'

/**
 * Emissão de eventos em tempo real pelo "servidor" mockado.
 * Fase 4 liga isso ao Socket.IO (binding do MSW); por enquanto é um no-op.
 */
export function emitNftUpdated(_nft: Nft) {}
export function emitOrderUpdated(_order: Order) {}
