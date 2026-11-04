import { useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { SearchIcon, SlidersHorizontal, XIcon } from 'lucide-react'
import { nftListQuery } from '@/api/nfts'
import { CATEGORIES, NETWORKS, SORTS, TABS } from '@/api/types'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { FilterPanel } from './FilterPanel'
import { NftCard, NftCardSkeleton } from './NftCard'
import { Pagination } from './Pagination'
import { toListQuery, type CatalogSearch } from './search-schema'

interface Props {
  search: CatalogSearch
  /** patch de filtros; qualquer mudança que não seja de página volta para a página 1 */
  onChange: (patch: Partial<CatalogSearch>, opts?: { keepPage?: boolean }) => void
  showFeatured?: boolean
}

export function CatalogSection({ search, onChange, showFeatured = true }: Props) {
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } = useQuery({ ...nftListQuery(toListQuery(search)), placeholderData: keepPreviousData })
  const [filtersOpen, setFiltersOpen] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)
  const tab = search.tab ?? 'all'

  const activeChips = [
    search.q && { key: 'q' as const, label: `Busca: “${search.q}”` },
    search.category && { key: 'category' as const, label: CATEGORIES.find((c) => c.id === search.category)!.label },
    search.network && { key: 'network' as const, label: NETWORKS.find((n) => n.id === search.network)!.label },
    (search.priceMin || search.priceMax) && {
      key: 'price' as const,
      label: `${search.priceMin ?? '0'} – ${search.priceMax ?? '∞'} ETH`,
    },
  ].filter(Boolean) as Array<{ key: 'q' | 'category' | 'network' | 'price'; label: string }>

  const clearChip = (key: (typeof activeChips)[number]['key']) =>
    onChange(key === 'price' ? { priceMin: undefined, priceMax: undefined } : { [key]: undefined })

  const goToPage = (p: number) => {
    onChange({ page: p === 1 ? undefined : p }, { keepPage: true })
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section id="catalogo" aria-labelledby="catalogo-titulo" className="container-k scroll-mt-20">
      <h2 id="catalogo-titulo" className="sr-only">
        Catálogo de NFTs
      </h2>

      <MobileSearch value={search.q} onSubmit={(q) => onChange({ q })} onOpenFilters={() => setFiltersOpen(true)} />

      <div className="grid gap-6 md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr] lg:gap-8">
        <aside className="hidden md:block" aria-label="Filtros">
          <div className="bg-card p-4">
            <FilterPanel search={search} facets={data?.facets} onChange={onChange} />
          </div>
          {showFeatured && <FeaturedPromo />}
        </aside>

        <div ref={topRef} className="min-w-0 scroll-mt-24">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-4 overflow-x-auto text-sm" role="group" aria-label="Destaques">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={tab === t.id}
                  onClick={() => onChange({ tab: t.id === 'all' ? undefined : t.id })}
                  className="shrink-0 border-b-2 border-transparent pb-1 whitespace-nowrap hover:text-primary aria-pressed:border-primary aria-pressed:font-semibold aria-pressed:text-primary"
                >
                  {t.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span>Ordenar por:</span>
              <select
                value={search.sort ?? 'recent'}
                onChange={(e) => onChange({ sort: e.target.value === 'recent' ? undefined : (e.target.value as CatalogSearch['sort']) })}
                className="rounded-sm border border-input bg-background px-2 py-1 text-sm"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {activeChips.length > 0 && (
            <ul className="mb-4 flex flex-wrap gap-2" aria-label="Filtros ativos">
              {activeChips.map((c) => (
                <li key={c.key}>
                  <button
                    type="button"
                    onClick={() => clearChip(c.key)}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/60 px-3 py-0.5 text-xs hover:bg-secondary"
                    aria-label={`Remover filtro ${c.label}`}
                  >
                    {c.label} <XIcon className="size-3" aria-hidden />
                  </button>
                </li>
              ))}
              <li>
                <Link to="." search={{}} className="text-xs text-primary underline-offset-2 hover:underline">
                  Limpar tudo
                </Link>
              </li>
            </ul>
          )}

          <p className="sr-only" role="status" aria-live="polite">
            {isPending ? 'Carregando NFTs' : data ? `${data.total} NFTs encontrados, página ${data.page} de ${data.totalPages}` : ''}
          </p>

          {isError && !data ? (
            <div role="alert" className="rounded-sm border border-destructive/50 bg-card p-6 text-center">
              <p className="font-semibold">Não foi possível carregar o catálogo.</p>
              <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-4 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Tentar novamente
              </button>
            </div>
          ) : isPending ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-6" aria-busy="true">
              {Array.from({ length: 9 }, (_, i) => (
                <NftCardSkeleton key={i} />
              ))}
            </div>
          ) : data.items.length === 0 ? (
            <div className="rounded-sm bg-card p-8 text-center">
              <p className="font-semibold">Nenhum NFT encontrado</p>
              <p className="mt-1 text-sm text-muted-foreground">Ajuste a busca ou os filtros para ver mais resultados.</p>
              <Link to="." search={{}} className="mt-4 inline-block text-sm text-primary hover:underline">
                Limpar filtros
              </Link>
            </div>
          ) : (
            <>
              {isError && (
                <p role="alert" className="mb-3 text-sm text-destructive">
                  Falha ao atualizar. Exibindo os últimos resultados.{' '}
                  <button type="button" className="underline" onClick={() => refetch()}>
                    Tentar novamente
                  </button>
                </p>
              )}
              <ul
                className={cn(
                  'grid grid-cols-2 gap-x-4 gap-y-8 transition-opacity lg:grid-cols-3 lg:gap-x-6',
                  isFetching && isPlaceholderData && 'opacity-60',
                )}
                aria-busy={isFetching}
              >
                {data.items.map((nft, i) => (
                  <li key={nft.id}>
                    <NftCard nft={nft} priority={i < 3} />
                  </li>
                ))}
              </ul>
              <div className="mt-10">
                <Pagination page={data.page} totalPages={data.totalPages} onPage={goToPage} />
              </div>
            </>
          )}
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto bg-card p-4">
          <SheetHeader className="p-0">
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>Os filtros são aplicados imediatamente.</SheetDescription>
          </SheetHeader>
          <FilterPanel search={search} facets={data?.facets} onChange={onChange} />
        </SheetContent>
      </Sheet>
    </section>
  )
}

function MobileSearch({
  value,
  onSubmit,
  onOpenFilters,
}: {
  value?: string
  onSubmit: (q: string | undefined) => void
  onOpenFilters: () => void
}) {
  const [text, setText] = useState(value ?? '')
  const [prev, setPrev] = useState(value)
  if (prev !== value) {
    setPrev(value)
    setText(value ?? '')
  }
  return (
    <div className="mb-5 flex gap-3 md:hidden">
      <form
        role="search"
        className="flex h-11 flex-1 items-center gap-2 rounded-xl bg-card px-3"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(text.trim() || undefined)
        }}
      >
        <SearchIcon className="size-5 text-muted-foreground" aria-hidden />
        <label htmlFor="mobile-search" className="sr-only">
          Explorar coleções
        </label>
        <input
          id="mobile-search"
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Explorar coleções"
          className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
        />
      </form>
      <button
        type="button"
        onClick={onOpenFilters}
        className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground"
        aria-label="Abrir filtros"
      >
        <SlidersHorizontal className="size-5" aria-hidden />
      </button>
    </div>
  )
}

function FeaturedPromo() {
  return (
    <Link
      to="/nft/$nftId"
      params={{ nftId: 'sage-nomad-009' }}
      className="mt-4 block bg-card pt-4 hover:ring-1 hover:ring-primary"
      aria-label="NFT em destaque: Sage Nomad #009, oferta limitada"
    >
      <p className="px-3 text-lg font-bold text-primary">NFT EM DESTAQUE</p>
      <p className="mb-3 text-center font-bold">OFERTA LIMITADA</p>
      <img src="/nfts/sage.webp" alt="" width={240} height={240} loading="lazy" className="w-full rounded-xl" />
    </Link>
  )
}
