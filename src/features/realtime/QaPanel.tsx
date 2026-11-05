import { useState } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { FlaskConicalIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { devExpireSession } from '@/features/auth/auth-actions'
import { useUser } from '@/features/auth/session-store'
import { useCart } from '@/features/cart/use-cart'
import { useRealtimeStatus } from './realtime-client'

const SCENARIOS = [
  'default',
  'slow',
  'catalog-error',
  'flaky',
  'timeout',
  'session-expired',
  'coupon-error',
  'price-change',
  'stock-conflict',
  'order-timeout',
  'payment-rejected',
  'wallet-rejected',
  'wallet-disconnect',
]

function qaEnabled() {
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.get('qa') === '1') localStorage.setItem('kurio:qa', '1')
    if (url.searchParams.get('qa') === '0') localStorage.removeItem('kurio:qa')
    return localStorage.getItem('kurio:qa') === '1'
  } catch {
    return false
  }
}

/**
 * Painel de QA (abra com ?qa=1). Aciona o backend simulado via REST; os eventos resultantes
 * chegam pelo Socket.IO como em produção — a UI nunca injeta eventos no próprio estado.
 */
export function QaPanel() {
  const [enabled] = useState(qaEnabled)
  const [open, setOpen] = useState(false)
  const status = useRealtimeStatus()
  const user = useUser()
  const path = useRouterState({ select: (s) => s.location.pathname })
  const cart = useCart()
  // alvo: o NFT da página aberta; no carrinho/checkout, o primeiro item do carrinho
  const cartTarget = cart.items[0]
  const nftId = path.startsWith('/nft/')
    ? decodeURIComponent(path.split('/')[2])
    : (cartTarget?.nftId ?? 'emerald-ape-042')
  const editionId = !path.startsWith('/nft/') && cartTarget ? cartTarget.editionId : '1-50'
  const [scenario, setScenario] = useState(() => localStorage.getItem('kurio:scenario') ?? 'default')

  if (!enabled) return null

  const rt = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data } = await api.post('/__dev/realtime', { action, nftId, ...extra })
    toast.message(`QA: ${action}`, { description: JSON.stringify(data).slice(0, 120) })
  }

  return (
    <div className="fixed bottom-20 left-3 z-50 md:bottom-4">
      {open ? (
        <div className="w-72 rounded-md border border-primary/60 bg-card p-3 text-xs shadow-xl" role="region" aria-label="Painel de QA">
          <div className="mb-2 flex items-center justify-between">
            <strong>Painel de QA (backend simulado)</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar painel de QA">
              <XIcon className="size-4" aria-hidden />
            </button>
          </div>
          <p className="mb-2 text-muted-foreground">
            Socket: <span className="text-foreground">{status}</span> · NFT alvo: <span className="text-foreground">{nftId}</span>
          </p>
          <label className="mb-2 block">
            Cenário
            <select
              value={scenario}
              onChange={async (e) => {
                setScenario(e.target.value)
                await api.post('/__dev/scenario', { scenario: e.target.value })
                toast.message(`Cenário: ${e.target.value}`)
              }}
              className="mt-1 w-full rounded-sm border border-input bg-background px-2 py-1"
            >
              {SCENARIOS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <QaBtn onClick={() => rt('price')}>Preço +0.10</QaBtn>
            <QaBtn onClick={() => rt('stock', { editionId, available: 0 })}>Esgotar edição {editionId}</QaBtn>
            <QaBtn onClick={() => rt('duplicate')}>Evento duplicado</QaBtn>
            <QaBtn onClick={() => rt('stale')}>Evento velho</QaBtn>
            <QaBtn onClick={() => rt('disconnect')}>Derrubar socket</QaBtn>
            <QaBtn disabled={!user} onClick={() => devExpireSession().then(() => toast.message('Sessão expirada no servidor'))}>
              Expirar sessão
            </QaBtn>
            <QaBtn
              onClick={async () => {
                await api.post('/__dev/scenario', { reset: true, scenario: 'default' })
                localStorage.removeItem('kurio:session')
                localStorage.removeItem('kurio:guest-cart')
                window.location.reload()
              }}
            >
              Resetar tudo
            </QaBtn>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 rounded-full border border-primary bg-card px-3 py-2 text-xs text-primary shadow-lg"
        >
          <FlaskConicalIcon className="size-4" aria-hidden /> QA
        </button>
      )}
    </div>
  )
}

function QaBtn(props: React.ComponentProps<'button'>) {
  return <button type="button" {...props} className="rounded-sm border border-border px-2 py-1.5 text-left hover:border-primary disabled:opacity-40" />
}
