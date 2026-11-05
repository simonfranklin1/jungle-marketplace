import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangleIcon, Loader2Icon, MinusIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { api, isApiError } from '@/api/client'
import type { Quote, QuoteLine } from '@/api/types'
import { authDialog, useUser } from '@/features/auth/session-store'
import { useCart, useQuote } from '@/features/cart/use-cart'
import { RelatedCarousel } from '@/features/catalog/RelatedCarousel'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

export function CartPage() {
  const cart = useCart()
  const quote = useQuote(cart.items, cart.coupon)
  const user = useUser()
  const navigate = useNavigate()
  const priceChanges = usePriceChanges(quote.data?.lines)

  const lines = quote.data?.lines ?? []
  const blocking = (quote.data?.issues ?? []).length > 0
  const empty = !cart.isLoading && cart.items.length === 0

  const goCheckout = () => {
    if (!user) {
      authDialog.open('login', 'Entre para conectar sua carteira e finalizar a compra.', () => navigate({ to: '/checkout' }))
      return
    }
    navigate({ to: '/checkout' })
  }

  return (
    <div className="container-k pt-2 md:pt-6">
      <nav aria-label="Trilha de navegação" className="text-sm font-semibold max-md:hidden">
        <Link to="/" className="hover:text-primary">
          Início
        </Link>{' '}
        /{' '}
        <Link to="/mercado" className="hover:text-primary">
          Mercado
        </Link>{' '}
        / <span aria-current="page">Carrinho</span>
      </nav>
      <h1 className="sr-only">Carrinho</h1>

      {empty ? (
        <div className="mt-10 rounded-sm bg-card p-10 text-center">
          <p className="text-lg font-bold">Seu carrinho está vazio</p>
          <p className="mt-2 text-sm text-muted-foreground">Explore o mercado e adicione NFTs para continuar.</p>
          <Link to="/mercado" className="mt-6 inline-block rounded-sm bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
            Explorar o mercado
          </Link>
        </div>
      ) : (
        <div className="mt-3 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-labelledby="cart-items">
            <h2 id="cart-items" className="sr-only">
              Itens do carrinho
            </h2>
            <div className="hidden grid-cols-[minmax(0,2.2fr)_1fr_1.2fr_1fr_40px] gap-3 border-b border-border pb-2 text-sm font-semibold md:grid" aria-hidden>
              <span>NFTs</span>
              <span>Preço</span>
              <span>Edições</span>
              <span>Total</span>
              <span />
            </div>
            {quote.isError && !quote.data && (
              <div role="alert" className="mt-4 rounded-sm border border-destructive/50 p-4 text-sm">
                Não foi possível calcular o carrinho.{' '}
                <button type="button" onClick={() => quote.refetch()} className="text-primary underline">
                  Tentar novamente
                </button>
              </div>
            )}
            <ul className="mt-3 space-y-5 md:space-y-3" aria-busy={quote.isFetching}>
              {cart.isLoading || (quote.isPending && cart.items.length > 0)
                ? cart.items.map((i) => <li key={`${i.nftId}-${i.editionId}`} className="shimmer h-20 rounded-sm" aria-hidden />)
                : lines.map((line) => (
                    <CartRow
                      key={`${line.nftId}-${line.editionId}`}
                      line={line}
                      issue={quote.data?.issues.find((x) => x.nftId === line.nftId && (x.type !== 'UNAVAILABLE' || x.editionId === line.editionId))}
                      priceChange={priceChanges[line.nftId]}
                      onQty={(q) => cart.setQuantity(line.nftId, line.editionId, q)}
                      onRemove={() => {
                        cart.remove(line.nftId, line.editionId)
                        toast.success(`${line.name} removido do carrinho.`)
                      }}
                    />
                  ))}
            </ul>
            {quote.data?.issues
              .filter((x) => x.type === 'NOT_FOUND')
              .map((x) => (
                <p key={x.nftId} role="alert" className="mt-3 flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangleIcon className="size-4" aria-hidden /> Um item não está mais disponível no catálogo.
                  <button
                    type="button"
                    className="underline"
                    onClick={() => cart.items.filter((i) => i.nftId === x.nftId).forEach((i) => cart.remove(i.nftId, i.editionId))}
                  >
                    Remover
                  </button>
                </p>
              ))}
          </section>

          <aside aria-labelledby="summary-title" className="max-md:-mx-6 max-md:rounded-t-[32px] max-md:bg-[#1c110d] max-md:px-6 max-md:pt-6 max-md:pb-8 lg:sticky lg:top-20 lg:self-start">
            <h2 id="summary-title" className="border-b border-border pb-2 text-lg font-bold max-md:sr-only">
              Resumo da carteira
            </h2>
            <CouponBox coupon={cart.coupon} onApply={cart.setCoupon} items={cart.items} quote={quote.data} />
            <Summary quote={quote.data} loading={quote.isPending} />
            {blocking && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                Ajuste os itens indisponíveis para continuar.
              </p>
            )}
            <button
              type="button"
              onClick={goCheckout}
              disabled={blocking || !quote.data || quote.isFetching || cart.isSaving}
              className="mt-5 h-10 w-full rounded-sm bg-primary font-semibold text-primary-foreground hover:bg-primary/85 disabled:opacity-50 max-md:h-14 max-md:rounded-full max-md:bg-gradient-to-b max-md:from-[#e09a5c] max-md:to-primary"
            >
              Conectar e finalizar
            </button>
            <Link to="/mercado" className="mt-4 block text-center text-sm text-primary hover:underline max-md:hidden">
              Continuar explorando
            </Link>
          </aside>
        </div>
      )}

      <div className="max-md:hidden">
      <RelatedCarousel nftId={cart.items[0]?.nftId ?? 'emerald-ape-042'} title="Colecionadores também viram" />
      </div>
    </div>
  )
}

/** Lembra o último preço visto de cada NFT para avisar quando ele muda (ex.: evento em tempo real). */
function usePriceChanges(lines?: QuoteLine[]) {
  const [seen, setSeen] = useState<Record<string, string>>({})
  const [changes, setChanges] = useState<Record<string, { from: string; to: string }>>({})
  if (lines) {
    const diff: Record<string, { from: string; to: string }> = {}
    let dirty = false
    for (const l of lines) {
      if (seen[l.nftId] !== l.unitPriceEth) dirty = true
      if (seen[l.nftId] && seen[l.nftId] !== l.unitPriceEth) diff[l.nftId] = { from: seen[l.nftId], to: l.unitPriceEth }
    }
    if (dirty) {
      setSeen((s) => ({ ...s, ...Object.fromEntries(lines.map((l) => [l.nftId, l.unitPriceEth])) }))
      if (Object.keys(diff).length) setChanges((c) => ({ ...c, ...diff }))
    }
  }
  return changes
}

function CartRow({
  line,
  issue,
  priceChange,
  onQty,
  onRemove,
}: {
  line: QuoteLine
  issue?: Quote['issues'][number]
  priceChange?: { from: string; to: string }
  onQty: (q: number) => void
  onRemove: () => void
}) {
  const max = Math.max(line.available, 0)
  const unavailable = issue?.type === 'UNAVAILABLE'
  return (
    <li className={cn('bg-card max-md:overflow-hidden max-md:rounded-[16px]', unavailable && 'ring-1 ring-destructive/60')}>
      <div className="flex h-[100px] md:hidden">
        <img src={line.thumb} alt="" width={100} height={100} className="size-[100px] shrink-0 object-cover" />
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 py-3 pr-3 pl-3">
          <div className="min-w-0">
            <Link to="/nft/$nftId" params={{ nftId: line.nftId }} className="block truncate text-sm font-bold hover:text-primary">
              {line.name}
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">Edição: {line.editionLabel}</p>
            <p className="mt-3 text-base font-bold text-price">
              <span className="sr-only">Total do item: </span>
              {formatEth(line.lineTotalEth)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={onRemove}
              className="grid size-7 place-items-center rounded-sm text-primary"
              aria-label={`Remover ${line.name} do carrinho`}
            >
              <Trash2Icon className="size-4" aria-hidden />
            </button>
            <div className="flex items-center gap-2" role="group" aria-label={`Quantidade de ${line.name}`}>
              <button
                type="button"
                onClick={() => onQty(line.quantity - 1)}
                disabled={line.quantity <= 1}
                className="grid size-6 place-items-center rounded-full bg-secondary text-foreground disabled:opacity-40"
                aria-label="Diminuir quantidade"
              >
                <MinusIcon className="size-3.5" aria-hidden />
              </button>
              <output className="w-4 text-center text-sm" aria-live="polite">
                {line.quantity}
              </output>
              <button
                type="button"
                onClick={() => onQty(line.quantity + 1)}
                disabled={line.quantity >= max}
                className="grid size-6 place-items-center rounded-full bg-secondary text-foreground disabled:opacity-40"
                aria-label="Aumentar quantidade"
              >
                <PlusIcon className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="hidden grid-cols-[64px_minmax(0,1fr)] items-center gap-3 md:grid md:grid-cols-[minmax(0,2.2fr)_1fr_1.2fr_1fr_40px]">
        <div className="col-span-1 flex items-center gap-4 md:col-span-1">
          <img src={line.thumb} alt="" width={80} height={80} className="size-16 shrink-0 object-cover md:size-20" />
          <div className="hidden min-w-0 md:block">
            <Link to="/nft/$nftId" params={{ nftId: line.nftId }} className="block font-semibold break-words hover:text-primary">
              {line.name}
            </Link>
            <p className="text-sm text-muted-foreground">ID do token: {line.tokenId}</p>
            <p className="text-xs text-muted-foreground">Edição {line.editionLabel}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2 pr-3 md:contents">
          <div className="w-full md:hidden">
            <Link to="/nft/$nftId" params={{ nftId: line.nftId }} className="font-semibold hover:text-primary">
              {line.name}
            </Link>
            <p className="text-xs text-muted-foreground">
              {line.tokenId} · Edição {line.editionLabel}
            </p>
          </div>
          <span className="text-sm font-semibold">
            <span className="sr-only">Preço unitário: </span>
            {formatEth(line.unitPriceEth)}
          </span>
          <div className="flex items-center gap-2" role="group" aria-label={`Quantidade de ${line.name}`}>
            <button
              type="button"
              onClick={() => onQty(line.quantity - 1)}
              disabled={line.quantity <= 1}
              className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              aria-label="Diminuir quantidade"
            >
              <MinusIcon className="size-3.5" aria-hidden />
            </button>
            <output className="w-6 text-center" aria-live="polite">
              {line.quantity}
            </output>
            <button
              type="button"
              onClick={() => onQty(line.quantity + 1)}
              disabled={line.quantity >= max}
              className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              aria-label="Aumentar quantidade"
            >
              <PlusIcon className="size-3.5" aria-hidden />
            </button>
          </div>
          <span className="font-semibold text-price">
            <span className="sr-only">Total do item: </span>
            {formatEth(line.lineTotalEth)}
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto grid size-9 place-items-center rounded-sm text-primary hover:bg-secondary md:ml-0"
            aria-label={`Remover ${line.name} do carrinho`}
          >
            <Trash2Icon className="size-5" aria-hidden />
          </button>
        </div>
      </div>
      {(unavailable || priceChange) && (
        <div className="space-y-1 border-t border-border px-3 py-2 text-xs" role="status" aria-live="polite">
          {unavailable && (
            <p className="flex flex-wrap items-center gap-2 text-destructive">
              <AlertTriangleIcon className="size-4" aria-hidden />
              {issue.available === 0 ? 'Esta edição esgotou.' : `Apenas ${issue.available} disponível(is) nesta edição.`}
              <button type="button" className="underline" onClick={() => (issue.available === 0 ? onRemove() : onQty(issue.available))}>
                {issue.available === 0 ? 'Remover item' : `Ajustar para ${issue.available}`}
              </button>
            </p>
          )}
          {priceChange && (
            <p className="text-primary">
              Preço atualizado: de {formatEth(priceChange.from)} para {formatEth(priceChange.to)}.
            </p>
          )}
        </div>
      )}
    </li>
  )
}

function CouponBox({
  coupon,
  onApply,
  items,
  quote,
}: {
  coupon: string | null
  onApply: (c: string | null) => void
  items: { nftId: string; editionId: string; quantity: number }[]
  quote?: Quote
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const validate = useMutation({
    mutationFn: (c: string) => api.post<{ code: string; percent: number }>('/coupons/validate', { code: c, items }).then((r) => r.data),
    onSuccess: (data) => {
      onApply(data.code)
      setCode('')
      setError(null)
      toast.success(`Cupom ${data.code} aplicado: ${data.percent}% de desconto.`)
    },
    onError: (e) => setError(isApiError(e) ? e.message : 'Não foi possível validar o cupom.'),
  })

  return (
    <div className="mt-4">
      {coupon ? (
        <div className="flex items-center justify-between rounded-sm border border-primary/60 px-3 py-2 text-sm">
          <span>
            Cupom <strong className="text-primary">{coupon}</strong>
            {quote?.coupon && ` (−${quote.coupon.percent}%)`}
          </span>
          <button
            type="button"
            className="text-primary underline"
            onClick={() => {
              onApply(null)
              toast.info('Cupom removido.')
            }}
          >
            Remover
          </button>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (!code.trim()) return setError('Informe um código promocional.')
            validate.mutate(code.trim())
          }}
        >
          <label htmlFor="coupon" className="text-sm font-semibold max-md:sr-only">
            Código promocional
          </label>
          <div className="relative mt-2 flex">
            <input
              id="coupon"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Digite o código promocional..."
              aria-invalid={!!error}
              aria-describedby={error ? 'coupon-error' : 'coupon-hint'}
              className="h-11 min-w-0 flex-1 rounded-l-sm border border-primary/60 max-md:rounded-full max-md:border-border max-md:pr-28 bg-background px-3 text-sm uppercase placeholder:normal-case placeholder:text-muted-foreground aria-invalid:border-destructive"
            />
            <button
              type="submit"
              disabled={validate.isPending}
              className="inline-flex h-11 items-center gap-1 rounded-l-none rounded-r-[3px] bg-primary px-5 max-md:absolute max-md:top-1 max-md:right-1 max-md:h-9 max-md:rounded-full font-semibold text-primary-foreground disabled:opacity-60"
            >
              {validate.isPending && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
              Aplicar
            </button>
          </div>
          {error ? (
            <p id="coupon-error" role="alert" className="mt-1 text-xs text-destructive">
              {error}
            </p>
          ) : (
            <p id="coupon-hint" className="mt-1 text-xs text-muted-foreground max-md:sr-only">
              Experimente KURIO10.
            </p>
          )}
        </form>
      )}
      {coupon && quote?.couponError && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {quote.couponError}
        </p>
      )}
    </div>
  )
}

export function Summary({ quote, loading, networkPending = false }: { quote?: Quote; loading: boolean; networkPending?: boolean }) {
  const row = 'flex justify-between gap-4'
  if (loading && !quote) return <div className="shimmer mt-6 h-32 rounded-sm" aria-hidden />
  if (!quote) return null
  return (
    <dl className="mt-6 space-y-3 text-sm" aria-live="polite">
      <div className={row}>
        <dt>Subtotal</dt>
        <dd className="text-base">{formatEth(quote.subtotalEth)}</dd>
      </div>
      <div className={row}>
        <dt>Desconto do lançamento</dt>
        <dd>(-) {formatEth(quote.discountEth)}</dd>
      </div>
      <div className={row}>
        <dt>Taxa de rede</dt>
        <dd className="text-base">{networkPending ? '—' : formatEth(quote.networkFeeEth)}</dd>
      </div>
      <p className="text-right text-xs text-primary">{networkPending ? 'Selecione uma rede para calcular' : 'Taxa estimada'}</p>
      <div className={cn(row, 'border-t border-border pt-3 text-base font-bold')}>
        <dt>Total</dt>
        <dd className="text-lg text-price">{networkPending ? '—' : formatEth(quote.totalEth)}</dd>
      </div>
    </dl>
  )
}
