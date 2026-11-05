import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { nftDetailQuery } from '@/api/nfts'
import type { NftSummary } from '@/api/types'
import { CartOutlineIcon, HeartFilledIcon, HeartOutlineIcon, SearchOutlineIcon } from '@/components/figma-icons'
import { useCart } from '@/features/cart/use-cart'
import { useFavorites } from '@/features/favorites/use-favorites'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { pickDefaultEdition } from './editions'

/**
 * Card do catálogo (Figma): moldura #241612 com padding 4px nas laterais, 24px em cima e
 * 26px embaixo; imagem quadrada. No desktop, o hover mostra carrinho / favorito / lupa na
 * borda inferior da imagem; no mobile, só o coração no canto (como no frame mobile).
 */
export function NftCard({ nft, priority = false, className }: { nft: NftSummary; priority?: boolean; className?: string }) {
  const soldOut = nft.available === 0
  return (
    <article className={cn('group relative', className)}>
      <div className="relative rounded-3xl bg-[#241612] p-2 md:rounded-none md:px-1 md:pt-6 md:pb-[26px]">
        {nft.rarity === 'raro' && (
          <span className="absolute top-4 left-0 z-10 bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground md:top-6">RARO</span>
        )}
        {soldOut && (
          <span className="absolute bottom-4 left-3 z-10 rounded-sm bg-background/90 px-2 py-0.5 text-xs font-semibold md:top-8 md:right-3 md:bottom-auto md:left-auto">Esgotado</span>
        )}
        <img
          src={nft.image}
          alt={`Arte do NFT ${nft.name}`}
          width={320}
          height={320}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className="aspect-square w-full rounded-2xl object-cover md:rounded-xl"
        />
        <FavoriteBadge nftId={nft.id} name={nft.name} />
        <HoverActions nft={nft} soldOut={soldOut} />
      </div>
      <h3 className="mt-3 text-sm">
        <Link
          to="/nft/$nftId"
          params={{ nftId: nft.id }}
          className="after:absolute after:inset-0 hover:text-primary focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring"
        >
          {nft.name}
        </Link>
      </h3>
      <p className="text-sm font-bold">
        <span className="text-primary">{formatEth(nft.priceEth)}</span>
        {nft.previousPriceEth && (
          <>
            {' '}
            <span className="sr-only">preço anterior</span>
            <s className="font-normal text-subtle">{formatEth(nft.previousPriceEth)}</s>
          </>
        )}
      </p>
    </article>
  )
}

const actionBtn =
  'grid size-9 place-items-center rounded-md border border-white/10 bg-[#241612] text-[#F5F1EB] transition-colors hover:border-primary hover:text-primary disabled:opacity-50'

function HoverActions({ nft, soldOut }: { nft: NftSummary; soldOut: boolean }) {
  const qc = useQueryClient()
  const cart = useCart()
  const fav = useFavorites()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const on = fav.isFavorite(nft.id)

  const addToCart = async () => {
    setAdding(true)
    try {
      // o card só tem o resumo; a edição e o limite vêm do detalhe (cacheado pelo Query)
      const detail = await qc.fetchQuery(nftDetailQuery(nft.id))
      const edition = pickDefaultEdition(detail.editions)
      if (!edition || edition.available === 0) {
        toast.error(`${nft.name} está esgotado.`)
        return
      }
      const max = Math.min(edition.available, detail.maxPerOrder)
      const res = cart.add({ nftId: nft.id, editionId: edition.id, quantity: 1 }, max)
      if (res.capped) toast.warning(`Limite atingido: você já tem ${res.quantity} desta edição no carrinho.`)
      else
        toast.success(`${nft.name} (${edition.label}) adicionado ao carrinho.`, {
          action: { label: 'Ver carrinho', onClick: () => navigate({ to: '/carrinho' }) },
        })
    } catch {
      toast.error('Não foi possível adicionar ao carrinho.')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div
      className="absolute inset-x-0 bottom-[8px] z-10 hidden justify-center gap-3 opacity-0 transition-opacity group-hover:opacity-100 has-[:focus-visible]:opacity-100 md:flex"
      role="group"
      aria-label={`Ações rápidas para ${nft.name}`}
    >
      <button type="button" onClick={addToCart} disabled={soldOut || adding} className={actionBtn} aria-label={`Adicionar ${nft.name} ao carrinho`}>
        {adding ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : <CartOutlineIcon className="size-5" />}
      </button>
      <button
        type="button"
        onClick={() => fav.toggle(nft.id)}
        aria-pressed={on}
        aria-label={on ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
        className={cn(actionBtn, on && 'text-primary')}
      >
        {on ? <HeartFilledIcon className="h-[18px] w-5" /> : <HeartOutlineIcon className="h-[18px] w-5" />}
      </button>
      <button
        type="button"
        onClick={() => navigate({ to: '/nft/$nftId', params: { nftId: nft.id } })}
        className={actionBtn}
        aria-label={`Ver detalhes de ${nft.name}`}
      >
        <SearchOutlineIcon className="size-5" />
      </button>
    </div>
  )
}

/**
 * Coração no canto da imagem. Mobile: sempre visível (frame mobile). Desktop: só quando o NFT
 * está favoritado e o card NÃO está em hover (no hover, as 3 ações assumem).
 */
function FavoriteBadge({ nftId, name }: { nftId: string; name: string }) {
  const fav = useFavorites()
  const on = fav.isFavorite(nftId)
  return (
    <button
      type="button"
      onClick={() => fav.toggle(nftId)}
      aria-pressed={on}
      aria-label={on ? `Remover ${name} dos favoritos` : `Favoritar ${name}`}
      tabIndex={on ? 0 : undefined}
      className={cn(
        'absolute top-4 right-4 z-10 grid size-8 place-items-center rounded-full bg-[#241612]/90 text-primary md:top-8 md:right-3',
        on
          ? 'md:transition-opacity md:group-hover:pointer-events-none md:group-hover:opacity-0 md:group-has-[:focus-visible]:opacity-0'
          : 'md:hidden',
      )}
    >
      {on ? <HeartFilledIcon className="h-4 w-[18px]" /> : <HeartOutlineIcon className="h-4 w-[18px]" />}
    </button>
  )
}

export function NftCardSkeleton() {
  return (
    <div aria-hidden>
      <div className="rounded-3xl bg-[#241612] p-2 md:rounded-none md:px-1 md:pt-6 md:pb-[26px]">
        <div className="shimmer aspect-square rounded-2xl md:rounded-xl" />
      </div>
      <div className="shimmer mt-3 h-4 w-2/3 rounded-sm" />
      <div className="shimmer mt-2 h-4 w-1/3 rounded-sm" />
    </div>
  )
}
