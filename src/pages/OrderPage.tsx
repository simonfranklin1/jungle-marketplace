import { Link, useParams } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { meKeys } from '@/api/me'
import { Loader2Icon, XCircleIcon } from 'lucide-react'
import { isApiError } from '@/api/client'
import { orderQuery } from '@/api/orders'
import { NETWORKS, type Order } from '@/api/types'
import { authDialog, useUser } from '@/features/auth/session-store'
import { comingSoon } from '@/lib/coming-soon'
import { formatEth } from '@/lib/eth'
import { WALLETS } from '@/features/checkout/wallets'

/** Componente da rota /pedido/$orderId (carregado sob demanda). */
export function OrderRoutePage() {
  const { orderId } = useParams({ strict: false }) as { orderId: string }
  return <OrderPage orderId={orderId} />
}

export function OrderPage({ orderId }: { orderId: string }) {
  const user = useUser()
  const qc = useQueryClient()
  const { data: order, error, isPending, refetch } = useQuery({
    ...orderQuery(user?.id ?? 'anon', orderId),
    enabled: !!user,
  })
  // ao sair de "pendente", o servidor mexe no carrinho (rejeitado devolve itens): sincroniza
  const status = order?.status
  useEffect(() => {
    if (user && status && status !== 'pending') {
      void qc.invalidateQueries({ queryKey: meKeys.cart(user.id) })
      void qc.invalidateQueries({ queryKey: meKeys.orders(user.id), exact: true })
    }
  }, [status, user, qc])

  if (!user)
    return (
      <Center>
        <h1 className="text-xl font-bold">Entre para ver este pedido</h1>
        <button type="button" onClick={() => authDialog.open('login')} className="mt-6 rounded-sm bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
          Entrar
        </button>
      </Center>
    )
  if (isPending) return <Center><div className="shimmer mx-auto h-96 max-w-2xl rounded-sm" aria-busy="true" aria-label="Carregando pedido" /></Center>
  if (error)
    return (
      <Center>
        <h1 className="text-xl font-bold">
          {isApiError(error, 'NOT_FOUND') ? 'Pedido não encontrado' : isApiError(error, 'FORBIDDEN') ? 'Você não tem acesso a este pedido' : 'Não foi possível carregar o pedido'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        {!isApiError(error, 'NOT_FOUND') && !isApiError(error, 'FORBIDDEN') && (
          <button type="button" onClick={() => refetch()} className="mt-4 text-primary underline">
            Tentar novamente
          </button>
        )}
      </Center>
    )
  return <Receipt order={order} />
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="container-k py-16 text-center">{children}</div>
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')

function Receipt({ order }: { order: Order }) {
  const r = order.receipt
  const walletLabel = WALLETS.find((w) => w.id === r.walletType)?.label ?? r.walletType
  const networkLabel = NETWORKS.find((n) => n.id === r.network)?.label ?? r.network
  const shortTx = order.txHash ? `${order.txHash.slice(0, 6)}…${order.txHash.slice(-4)}` : '—'

  return (
    <div className="container-k py-10">
      <article className="mx-auto max-w-2xl border-b-8 border-primary bg-card" aria-labelledby="order-title">
        <header className="flex flex-col items-center gap-3 border-b border-primary/60 px-6 py-6 text-center" aria-live="polite">
          {order.status === 'pending' && <Loader2Icon className="size-14 animate-spin text-primary" aria-hidden />}
          {order.status === 'confirmed' && <ThankYouIcon />}
          {order.status === 'rejected' && <XCircleIcon className="size-14 text-destructive" aria-hidden />}
          <h1 id="order-title" className="text-lg font-bold text-[#e8c9a6]">
            {order.status === 'pending' && 'Processando seu pedido na rede…'}
            {order.status === 'confirmed' && 'Seus NFTs agora estão na sua carteira'}
            {order.status === 'rejected' && 'Pagamento recusado'}
          </h1>
          <p className="text-sm text-muted-foreground" role="status">
            {order.status === 'pending' && 'Aguardando confirmação da transação. Você pode sair desta página: o status é atualizado automaticamente.'}
            {order.status === 'rejected' && (order.failureReason ?? 'A transação não foi concluída.')}
          </p>
        </header>

        <dl className="grid grid-cols-2 gap-y-3 border-b border-primary/60 px-6 py-4 text-sm sm:grid-cols-4 sm:divide-x sm:divide-primary/60">
          <div className="sm:px-3">
            <dt className="font-bold">{order.txHash ? 'ID da transação' : 'Pedido'}</dt>
            <dd className="font-mono text-xs text-muted-foreground sm:text-sm">{order.txHash ? shortTx : order.id.slice(0, 12)}</dd>
          </div>
          <div className="sm:px-3">
            <dt>Data</dt>
            <dd className="text-muted-foreground">{fmtDate(order.createdAt)}</dd>
          </div>
          <div className="sm:px-3">
            <dt>Total</dt>
            <dd className="text-muted-foreground">{formatEth(r.totalEth)}</dd>
          </div>
          <div className="sm:px-3">
            <dt className="font-bold">Carteira</dt>
            <dd className="text-muted-foreground">{walletLabel}</dd>
          </div>
        </dl>

        <section className="px-6 py-6 sm:px-12" aria-labelledby="tx-details">
          <h2 id="tx-details" className="font-bold">
            Detalhes da transação
          </h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="pb-2 font-semibold">NFTs</th>
                <th scope="col" className="pb-2 text-center font-semibold">Edições</th>
                <th scope="col" className="pb-2 text-right font-semibold">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {r.lines.map((l) => (
                <tr key={`${l.nftId}-${l.editionId}`}>
                  <td className="py-2">
                    <div className="flex items-center gap-3">
                      <img src={l.thumb} alt="" width={56} height={56} className="size-14 rounded-sm object-cover" />
                      <div>
                        <p className="font-semibold">{l.name}</p>
                        <p className="text-xs text-muted-foreground">ID do token: {l.tokenId} · {l.editionLabel}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-center">(x {l.quantity})</td>
                  <td className="text-right font-bold text-primary">{formatEth(l.lineTotalEth)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {r.discountEth !== '0.00' && (
                <tr>
                  <td />
                  <th scope="row" className="pt-3 text-left font-normal">Desconto {r.coupon && `(${r.coupon})`}</th>
                  <td className="pt-3 text-right">(-) {formatEth(r.discountEth)}</td>
                </tr>
              )}
              <tr>
                <td />
                <th scope="row" className="pt-2 text-left font-normal">Taxa de rede</th>
                <td className="pt-2 text-right">{formatEth(r.networkFeeEth)}</td>
              </tr>
              <tr className="border-b border-border">
                <td />
                <th scope="row" className="py-2 text-left">Total</th>
                <td className="py-2 text-right text-base font-bold text-primary">{formatEth(r.totalEth)}</td>
              </tr>
            </tfoot>
          </table>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {order.status === 'confirmed' &&
              `Transação confirmada na ${networkLabel}. A propriedade foi transferida para sua carteira conectada e registrada na rede.`}
            {order.status === 'pending' && `Rede: ${networkLabel}. Nenhuma confirmação é exibida antes da resposta da rede.`}
            {order.status === 'rejected' && 'Seus itens continuam no carrinho para você tentar novamente.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {order.status === 'confirmed' && (
              <button
                type="button"
                onClick={() => comingSoon('O explorador de blocos (transação simulada)')}
                className="rounded-sm bg-primary px-5 py-3 font-bold text-primary-foreground hover:bg-primary/85"
              >
                Ver no Etherscan
              </button>
            )}
            {order.status === 'rejected' && (
              <Link to="/carrinho" className="rounded-sm bg-primary px-5 py-3 font-bold text-primary-foreground hover:bg-primary/85">
                Voltar ao carrinho
              </Link>
            )}
            <Link to="/mercado" className="rounded-sm border border-primary px-5 py-3 text-primary hover:bg-secondary">
              Continuar explorando
            </Link>
          </div>
        </section>
      </article>
    </div>
  )
}

function ThankYouIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary" aria-hidden>
      <path d="M8 26 32 8l24 18v30H8z" strokeLinejoin="round" />
      <path d="m8 26 24 18 24-18M8 56l18-16M56 56 38 40" strokeLinejoin="round" />
      <rect x="16" y="14" width="32" height="20" rx="2" fill="var(--card)" />
      <text x="32" y="23" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none">THANK</text>
      <text x="32" y="31" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none">YOU</text>
    </svg>
  )
}
