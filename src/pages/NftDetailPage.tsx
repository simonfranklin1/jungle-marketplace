import { useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, HeartIcon, MailIcon, MinusIcon, PlusIcon, SearchIcon, StarIcon } from 'lucide-react'
import { toast } from 'sonner'
import { nftDetailQuery, nftRelatedQuery } from '@/api/nfts'
import { isApiError } from '@/api/client'
import type { Edition, Nft } from '@/api/types'
import { NETWORKS } from '@/api/types'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { LinkedinIcon, TwitterIcon } from '@/components/brand-icons'
import { NftCard } from '@/features/catalog/NftCard'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

export function NftDetailPage({ nftId }: { nftId: string }) {
  const { data: nft, isPending, error, refetch } = useQuery(nftDetailQuery(nftId))

  if (isPending) return <DetailSkeleton />
  if (error) {
    if (isApiError(error, 'NOT_FOUND')) return <NftNotFound />
    return (
      <div className="container-k py-16 text-center" role="alert">
        <p className="font-semibold">Não foi possível carregar este NFT.</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        <button type="button" onClick={() => refetch()} className="mt-4 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Tentar novamente
        </button>
      </div>
    )
  }
  return <NftDetail key={nft.id} nft={nft} />
}

function Breadcrumb({ name }: { name?: string }) {
  return (
    <nav aria-label="Trilha de navegação" className="text-sm font-semibold">
      <ol className="flex flex-wrap gap-1">
        <li>
          <Link to="/" className="hover:text-primary">
            Início
          </Link>
          <span aria-hidden> / </span>
        </li>
        <li>
          <Link to="/mercado" className="hover:text-primary">
            Mercado
          </Link>
          {name && <span aria-hidden> / </span>}
        </li>
        {name && (
          <li aria-current="page" className="text-muted-foreground">
            {name}
          </li>
        )}
      </ol>
    </nav>
  )
}

const EDITION_PREFERENCE = ['1-50', '1-10', 'open', '1-1']
function firstAvailable(editions: Edition[]) {
  const byPref = [...editions].sort((a, b) => EDITION_PREFERENCE.indexOf(a.id) - EDITION_PREFERENCE.indexOf(b.id))
  return byPref.find((e) => e.available > 0) ?? editions[0]
}

function NftDetail({ nft }: { nft: Nft }) {
  const [editionId, setEditionId] = useState(() => firstAvailable(nft.editions).id)
  const [qty, setQty] = useState(1)
  const [zoom, setZoom] = useState(false)
  const [tab, setTab] = useState<'details' | 'reviews'>('details')

  const edition = nft.editions.find((e) => e.id === editionId) ?? nft.editions[0]
  const maxQty = Math.min(edition.available, nft.maxPerOrder)
  const soldOut = nft.editions.every((e) => e.available === 0)
  // se o estoque cair (ex.: evento em tempo real), a quantidade se ajusta
  const effectiveQty = Math.max(1, Math.min(qty, maxQty || 1))
  const networkLabel = NETWORKS.find((n) => n.id === nft.network)?.label ?? nft.network
  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

  return (
    <div className="container-k pt-6">
      <Breadcrumb />
      <div className="mt-3 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col-reverse gap-4 sm:flex-row">
          <ul className="flex gap-3 sm:flex-col" aria-label="Miniaturas">
            {[0, 1, 2, 3].map((i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setZoom(true)}
                  className="block size-16 overflow-hidden rounded-sm sm:size-20 lg:size-[88px]"
                  aria-label={`Ampliar imagem ${i + 1}`}
                >
                  <img src={nft.thumb} alt="" width={88} height={88} className="size-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
          <div className="relative flex-1 bg-card p-4">
            <img
              src={nft.image}
              alt={`Arte do NFT ${nft.name}`}
              width={560}
              height={560}
              fetchPriority="high"
              className="aspect-square w-full rounded-2xl object-cover"
            />
            <button
              type="button"
              onClick={() => setZoom(true)}
              className="absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-background/90 hover:text-primary"
              aria-label="Ampliar imagem"
            >
              <SearchIcon className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-wide md:text-3xl">{nft.name}</h1>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <p className="text-xl font-bold text-primary md:text-2xl" aria-live="polite">
              {formatEth(nft.priceEth)}
              {nft.previousPriceEth && (
                <s className="ml-2 text-base font-normal text-subtle">
                  <span className="sr-only">preço anterior </span>
                  {formatEth(nft.previousPriceEth)}
                </s>
              )}
            </p>
            <p className="flex items-center gap-1 text-sm">
              <span className="flex text-primary" aria-hidden>
                {Array.from({ length: 5 }, (_, i) => (
                  <StarIcon key={i} className={cn('size-3.5', i < Math.round(nft.rating) && 'fill-current')} />
                ))}
              </span>
              <span>
                <span className="sr-only">Nota {nft.rating.toFixed(1)} de 5, </span>
                {nft.reviewsCount} avaliações de colecionadores
              </span>
            </p>
          </div>

          <h2 className="mt-4 text-sm font-bold">Sobre este NFT:</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{nft.description}</p>

          <fieldset className="mt-4">
            <legend className="text-sm font-bold">Edição:</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {nft.editions.map((e) => {
                const disabled = e.available === 0
                return (
                  <label
                    key={e.id}
                    className={cn(
                      'cursor-pointer rounded-full border border-border px-2.5 py-0.5 text-xs has-checked:border-primary has-checked:text-primary has-focus-visible:outline-2 has-focus-visible:outline-ring',
                      disabled && 'cursor-not-allowed line-through opacity-50',
                    )}
                  >
                    <input
                      type="radio"
                      name="edition"
                      value={e.id}
                      checked={editionId === e.id}
                      disabled={disabled}
                      onChange={() => {
                        setEditionId(e.id)
                        setQty(1)
                      }}
                      className="sr-only"
                    />
                    {e.label.toUpperCase()}
                    {disabled && <span className="sr-only"> (esgotada)</span>}
                  </label>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
              {edition.available === 0
                ? 'Esta edição está esgotada.'
                : edition.supply === null
                  ? 'Edição aberta.'
                  : `${edition.available} de ${edition.supply} disponíveis.`}
            </p>
          </fieldset>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3" role="group" aria-label="Quantidade">
              <button
                type="button"
                onClick={() => setQty(effectiveQty - 1)}
                disabled={effectiveQty <= 1 || soldOut}
                className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
                aria-label="Diminuir quantidade"
              >
                <MinusIcon className="size-4" aria-hidden />
              </button>
              <output aria-live="polite" aria-label="Quantidade selecionada" className="w-6 text-center">
                {effectiveQty}
              </output>
              <button
                type="button"
                onClick={() => setQty(effectiveQty + 1)}
                disabled={effectiveQty >= maxQty || soldOut}
                className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
                aria-label="Aumentar quantidade"
              >
                <PlusIcon className="size-4" aria-hidden />
              </button>
              {maxQty > 0 && effectiveQty >= maxQty && (
                <span className="text-xs text-muted-foreground">Máximo de {maxQty} por pedido</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={soldOut || edition.available === 0}
                onClick={() => toast.info('Carrinho chega na próxima fase.')}
                className="h-9 rounded-sm bg-primary px-8 text-sm font-bold text-primary-foreground hover:bg-primary/85 disabled:opacity-40"
              >
                {soldOut ? 'ESGOTADO' : 'COMPRAR'}
              </button>
              <button
                type="button"
                onClick={() => toast.info('Entre para favoritar NFTs (próxima fase).')}
                className="inline-flex h-9 items-center gap-2 rounded-sm border border-primary px-3 text-sm text-primary hover:bg-secondary"
                aria-pressed={false}
              >
                <HeartIcon className="size-4" aria-hidden /> Favoritar
              </button>
            </div>
          </div>

          <dl className="mt-5 space-y-2 text-sm text-muted-foreground">
            <div>
              <dt className="inline">ID do token: </dt>
              <dd className="inline">{nft.tokenId}</dd>
            </div>
            <div>
              <dt className="inline">Coleção: </dt>
              <dd className="inline">{nft.collection}</dd>
            </div>
            <div>
              <dt className="inline">Atributos: </dt>
              <dd className="inline">{nft.attributes.join(', ')}</dd>
            </div>
          </dl>
          <div className="mt-3 flex items-center gap-3 text-sm font-bold">
            Compartilhar este NFT:
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Compartilhar no LinkedIn (abre em nova aba)"
              className="hover:text-primary"
            >
              <LinkedinIcon />
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent(nft.name)}&body=${encodeURIComponent(shareUrl)}`}
              aria-label="Compartilhar por e-mail"
              className="hover:text-primary"
            >
              <MailIcon className="size-4" aria-hidden />
            </a>
            <a
              href={`https://x.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(nft.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Compartilhar no X (abre em nova aba)"
              className="hover:text-primary"
            >
              <TwitterIcon />
            </a>
          </div>
        </div>
      </div>

      <section className="mt-14">
        <div role="tablist" aria-label="Informações do NFT" className="flex gap-8 border-b border-border">
          {(
            [
              ['details', 'Detalhes do NFT'],
              ['reviews', `Avaliações de colecionadores (${nft.reviewsCount})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              id={`tab-${id}`}
              role="tab"
              type="button"
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  const next = tab === 'details' ? 'reviews' : 'details'
                  setTab(next)
                  document.getElementById(`tab-${next}`)?.focus()
                }
              }}
              className="-mb-px border-b-2 border-transparent pb-2 text-sm md:text-base aria-selected:border-primary aria-selected:font-bold aria-selected:text-primary"
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'details' ? (
          <div id="panel-details" role="tabpanel" aria-labelledby="tab-details" className="mt-4 space-y-4 text-sm leading-6 text-muted-foreground">
            {nft.details.split('\n\n').map((p) => (
              <p key={p.slice(0, 20)}>{p}</p>
            ))}
            <dl className="space-y-3">
              <div>
                <dt className="font-bold text-foreground">Rede:</dt>
                <dd>Cunhado na {networkLabel} com procedência imutável e metadados armazenados no IPFS.</dd>
              </div>
              <div>
                <dt className="font-bold text-foreground">Contrato:</dt>
                <dd>{nft.contract} • Contrato inteligente ERC-721 verificado.</dd>
              </div>
              <div>
                <dt className="font-bold text-foreground">Direitos autorais:</dt>
                <dd>Direitos autorais do criador: {nft.royaltiesPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</dd>
              </div>
            </dl>
          </div>
        ) : (
          <div id="panel-reviews" role="tabpanel" aria-labelledby="tab-reviews" className="mt-4 text-sm text-muted-foreground">
            <p>
              Nota média <strong className="text-foreground">{nft.rating.toFixed(1)}</strong> de 5 com base em {nft.reviewsCount}{' '}
              avaliações. As avaliações detalhadas não fazem parte desta versão.
            </p>
          </div>
        )}
      </section>

      <Related nftId={nft.id} />

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-[min(92vw,720px)] bg-card p-3 sm:max-w-[min(92vw,720px)]">
          <DialogTitle className="sr-only">{nft.name}</DialogTitle>
          <img src={nft.image} alt={`Arte do NFT ${nft.name} ampliada`} width={640} height={640} className="w-full rounded-xl" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Related({ nftId }: { nftId: string }) {
  const { data } = useQuery(nftRelatedQuery(nftId))
  const ref = useRef<HTMLUListElement>(null)
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' })
  return (
    <section aria-labelledby="related" className="mt-16">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h2 id="related" className="font-bold text-primary">
          Mais desta coleção
        </h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => scroll(-1)} aria-label="Anteriores" className="grid size-8 place-items-center rounded-full border border-primary text-primary">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={() => scroll(1)} aria-label="Próximos" className="grid size-8 place-items-center rounded-full border border-primary text-primary">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <ul ref={ref} className="mt-6 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [scrollbar-width:none]">
        {(data ?? Array.from({ length: 5 }, () => null)).map((n, i) => (
          <li key={n?.id ?? i} className="w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-[18.4%]">
            {n ? <NftCard nft={n} /> : <div className="shimmer aspect-[1/1.1]" aria-hidden />}
          </li>
        ))}
      </ul>
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div className="container-k pt-6" aria-busy="true" aria-label="Carregando NFT">
      <Breadcrumb />
      <div className="mt-3 grid gap-8 lg:grid-cols-2">
        <div className="shimmer aspect-square rounded-sm" />
        <div className="space-y-4">
          <div className="shimmer h-8 w-2/3 rounded-sm" />
          <div className="shimmer h-6 w-1/3 rounded-sm" />
          <div className="shimmer h-24 rounded-sm" />
          <div className="shimmer h-10 w-1/2 rounded-sm" />
        </div>
      </div>
    </div>
  )
}

function NftNotFound() {
  return (
    <div className="container-k py-20 text-center">
      <p className="text-5xl font-bold text-primary">404</p>
      <h1 className="mt-4 text-xl font-bold">NFT não encontrado</h1>
      <p className="mt-2 text-sm text-muted-foreground">Ele pode ter sido removido ou o link está incorreto.</p>
      <Link to="/mercado" className="mt-6 inline-block rounded-sm bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
        Voltar ao mercado
      </Link>
    </div>
  )
}
