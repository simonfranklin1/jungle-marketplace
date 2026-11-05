import { Link } from '@tanstack/react-router'
import { useQueries } from '@tanstack/react-query'
import { nftDetailQuery } from '@/api/nfts'
import { NftCard, NftCardSkeleton } from '@/features/catalog/NftCard'
import { useFavorites } from '@/features/favorites/use-favorites'

export function FavoritesPage() {
  const favorites = useFavorites()
  const results = useQueries({ queries: favorites.ids.map((id) => nftDetailQuery(id)) })

  return (
    <section aria-labelledby="fav-title">
      <h2 id="fav-title" className="mb-5 text-lg font-bold">
        Lista de interesse
      </h2>
      {favorites.ids.length === 0 ? (
        <div className="rounded-sm bg-card p-8 text-center">
          <p className="font-semibold">Nenhum NFT favoritado ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">Toque no coração de um NFT para acompanhá-lo aqui.</p>
          <Link to="/mercado" className="mt-4 inline-block text-sm text-primary hover:underline">
            Explorar o mercado
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3">
          {results.map((r, i) => (
            <li key={favorites.ids[i]}>{r.data ? <NftCard nft={r.data} /> : <NftCardSkeleton />}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
