import { Link } from '@tanstack/react-router'
import { HeartIcon } from 'lucide-react'
import { useFavorites } from '@/features/favorites/use-favorites'
import type { NftSummary } from '@/api/types'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

export function NftCard({ nft, priority = false, className }: { nft: NftSummary; priority?: boolean; className?: string }) {
  const soldOut = nft.available === 0
  return (
    <article className={cn('group relative', className)}>
      <div className="relative aspect-[1/1.1] bg-card p-2">
        {nft.rarity === 'raro' && (
          <span className="absolute top-2 left-0 z-10 bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
            RARO
          </span>
        )}
        {soldOut && (
          <span className="absolute top-2 right-2 z-10 rounded-sm bg-background/90 px-2 py-0.5 text-xs font-semibold">
            Esgotado
          </span>
        )}
        <FavoriteButton nftId={nft.id} name={nft.name} />
        <img
          src={nft.image}
          alt={`Arte do NFT ${nft.name}`}
          width={320}
          height={320}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className="size-full rounded-xl object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
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

export function NftCardSkeleton() {
  return (
    <div aria-hidden>
      <div className="shimmer aspect-[1/1.1] rounded-sm" />
      <div className="shimmer mt-3 h-4 w-2/3 rounded-sm" />
      <div className="shimmer mt-2 h-4 w-1/3 rounded-sm" />
    </div>
  )
}

function FavoriteButton({ nftId, name }: { nftId: string; name: string }) {
  const fav = useFavorites()
  const on = fav.isFavorite(nftId)
  return (
    <button
      type="button"
      onClick={() => fav.toggle(nftId)}
      aria-pressed={on}
      aria-label={on ? `Remover ${name} dos favoritos` : `Favoritar ${name}`}
      className={cn(
        'absolute right-4 bottom-4 z-10 grid size-9 place-items-center rounded-full bg-background/85 text-primary transition-opacity hover:bg-background focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100',
        on && 'md:opacity-100',
      )}
    >
      <HeartIcon className={cn('size-4', on && 'fill-current')} aria-hidden />
    </button>
  )
}
