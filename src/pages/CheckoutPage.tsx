import { useId, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangleIcon, CheckCircle2Icon, Loader2Icon, PlugZapIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError, api, isApiError } from '@/api/client'
import { meKeys } from '@/api/me'
import { connectWallet, createOrder, type CreateOrderPayload } from '@/api/orders'
import { NETWORKS, type Network, type Quote, type WalletType } from '@/api/types'
import { WalletsBadge } from '@/components/layout/Footer'
import { Field, inputCls } from '@/features/auth/AuthDialog'
import { authDialog, useUser } from '@/features/auth/session-store'
import { quoteKey, useCart, useQuote } from '@/features/cart/use-cart'
import { Summary } from '@/pages/CartPage'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { WALLETS } from '@/features/checkout/wallets'

type WalletState =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'connected'; address: string; walletType: WalletType; network: Network }
  | { status: 'rejected'; message: string }
  | { status: 'disconnected'; message: string }

type Phase = 'idle' | 'revalidating' | 'submitting' | 'retrying'

const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface FormValues {
  displayName: string
  username: string
  network: Network | ''
  profileName: string
  walletAddress: string
  secondaryWallet: string
  walletType: WalletType | ''
  referralCode: string
  email: string
  ensName: string
  note: string
}

function validate(v: FormValues, useOther: boolean, wallet: WalletState): Record<string, string> {
  const e: Record<string, string> = {}
  if (v.displayName.trim().length < 2) e.displayName = 'Informe o nome de exibição.'
  if (!/^[a-z0-9_.]{3,20}$/i.test(v.username.trim())) e.username = 'Use 3 a 20 letras, números, _ ou .'
  if (!v.network) e.network = 'Selecione uma rede.'
  if (v.profileName.trim().length < 2) e.profileName = 'Informe o nome do perfil.'
  if (!v.walletType) e.walletType = 'Selecione uma carteira.'
  if (useOther) {
    if (!ADDRESS.test(v.walletAddress.trim())) e.walletAddress = 'Endereço inválido: use 0x seguido de 40 caracteres hexadecimais.'
  } else if (wallet.status !== 'connected') e.walletAddress = 'Conecte sua carteira para preencher o endereço.'
  if (v.referralCode && !/^[A-Z0-9-]{4,16}$/i.test(v.referralCode.trim())) e.referralCode = 'Código de indicação inválido.'
  if (!EMAIL.test(v.email.trim())) e.email = 'Informe um e-mail válido.'
  if (!/^[a-z0-9-]{3,32}$/i.test(v.ensName.trim())) e.ensName = 'Use 3 a 32 letras, números ou hífen.'
  if (v.note.length > 280) e.note = 'Máximo de 280 caracteres.'
  return e
}

export function CheckoutPage() {
  const user = useUser()
  const cart = useCart()

  if (!user)
    return (
      <div className="container-k py-20 text-center">
        <h1 className="text-xl font-bold">Entre para finalizar a compra</h1>
        <p className="mt-2 text-sm text-muted-foreground">Seu carrinho fica salvo enquanto você entra.</p>
        <button
          type="button"
          onClick={() => authDialog.open('login', 'Entre para conectar sua carteira e finalizar a compra.')}
          className="mt-6 rounded-sm bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Entrar
        </button>
      </div>
    )
  if (cart.isLoading) return <div className="container-k pt-10"><div className="shimmer h-96 rounded-sm" aria-busy="true" aria-label="Carregando" /></div>
  if (cart.items.length === 0)
    return (
      <div className="container-k py-20 text-center">
        <h1 className="text-xl font-bold">Seu carrinho está vazio</h1>
        <Link to="/mercado" className="mt-6 inline-block rounded-sm bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
          Explorar o mercado
        </Link>
      </div>
    )
  return <CheckoutForm key={user.id} />
}

function CheckoutForm() {
  const user = useUser()!
  const cart = useCart()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const uid = useId()

  const [values, setValues] = useState<FormValues>({
    displayName: user.displayName,
    username: user.username,
    network: 'ethereum',
    profileName: user.displayName,
    walletAddress: '',
    secondaryWallet: '',
    walletType: '',
    referralCode: '',
    email: user.email,
    ensName: user.ensName,
    note: '',
  })
  const [useOther, setUseOther] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [wallet, setWallet] = useState<WalletState>({ status: 'idle' })
  const [phase, setPhase] = useState<Phase>('idle')
  const [alert, setAlert] = useState<{ tone: 'error' | 'info'; text: string; kind?: 'validation' } | null>(null)
  const attempt = useRef<{ fp: string; key: string } | null>(null)

  const network = (values.network || 'ethereum') as Network
  const quote = useQuote(cart.items, cart.coupon, network)
  const busy = phase !== 'idle'

  const set = (k: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.value
    setValues((v) => ({ ...v, [k]: value }))
    if (errors[k]) setErrors(({ [k]: _drop, ...rest }) => rest)
    // trocar de rede/carteira derruba a conexão atual
    if ((k === 'network' || k === 'walletType') && wallet.status === 'connected') setWallet({ status: 'idle' })
  }

  const chooseWallet = (id: WalletType) => {
    setValues((v) => ({ ...v, walletType: id }))
    setErrors(({ walletType: _a, ...rest }) => rest)
    if (wallet.status === 'connected' && wallet.walletType !== id) setWallet({ status: 'idle' })
  }

  const doConnect = async () => {
    if (!values.walletType) {
      setErrors((e) => ({ ...e, walletType: 'Selecione uma carteira.' }))
      return
    }
    setWallet({ status: 'connecting' })
    try {
      const w = await connectWallet(values.walletType, network)
      setWallet({ status: 'connected', ...w })
      if (!useOther) setValues((v) => ({ ...v, walletAddress: w.address }))
      setErrors(({ walletAddress: _a, ...rest }) => rest)
      toast.success('Carteira conectada.')
    } catch (e) {
      setWallet({ status: 'rejected', message: isApiError(e) ? e.message : 'Não foi possível conectar a carteira.' })
    }
  }

  const applyServerQuote = (q: Quote) => {
    qc.setQueryData(quoteKey(cart.items, cart.coupon, network), q)
  }

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (busy) return
    setAlert(null)
    const errs = validate(values, useOther, wallet)
    setErrors(errs)
    if (Object.keys(errs).length) {
      setAlert({ tone: 'error', text: '', kind: 'validation' })
      requestAnimationFrame(() => (document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus())
      return
    }
    if (wallet.status !== 'connected') {
      setAlert({ tone: 'error', text: 'Conecte sua carteira antes de confirmar.' })
      return
    }
    const seen = quote.data
    if (!seen) return

    // 1) revalida preço, estoque, cupom e taxa imediatamente antes de confirmar
    setPhase('revalidating')
    let fresh: Quote
    try {
      fresh = await api.post<Quote>('/quote', { items: cart.items, coupon: cart.coupon, network }).then((r) => r.data)
    } catch (e) {
      setPhase('idle')
      setAlert({ tone: 'error', text: isApiError(e) ? e.message : 'Falha ao revalidar o pedido.' })
      return
    }
    applyServerQuote(fresh)
    if (fresh.issues.length) {
      setPhase('idle')
      setAlert({ tone: 'error', text: 'Alguns itens ficaram indisponíveis. Ajuste o carrinho para continuar.' })
      return
    }
    if (cart.coupon && !fresh.coupon) {
      setPhase('idle')
      setAlert({ tone: 'error', text: fresh.couponError ?? 'O cupom não é mais válido.' })
      return
    }
    if (fresh.totalEth !== seen.totalEth) {
      setPhase('idle')
      setAlert({ tone: 'info', text: `O total mudou de ${formatEth(seen.totalEth)} para ${formatEth(fresh.totalEth)}. Revise e confirme novamente.` })
      return
    }

    // 2) cria o pedido com chave de idempotência (a mesma chave é reutilizada em novas tentativas)
    const payload: CreateOrderPayload = {
      items: cart.items,
      coupon: cart.coupon,
      network,
      walletType: wallet.walletType,
      walletAddress: values.walletAddress.trim(),
      expectedTotalEth: fresh.totalEth,
      buyer: {
        displayName: values.displayName.trim(),
        username: values.username.trim(),
        profileName: values.profileName.trim(),
        email: values.email.trim(),
        ensName: `${values.ensName.trim()}.eth`,
        referralCode: values.referralCode.trim(),
        secondaryWallet: values.secondaryWallet.trim(),
        note: values.note.trim(),
      },
    }
    const fp = JSON.stringify(payload)
    if (!attempt.current || attempt.current.fp !== fp) attempt.current = { fp, key: crypto.randomUUID() }
    const key = attempt.current.key

    setPhase('submitting')
    for (let tryN = 0; tryN < 3; tryN++) {
      try {
        const order = await createOrder(payload, key)
        qc.setQueryData(meKeys.order(user.id, order.id), order)
        qc.invalidateQueries({ queryKey: meKeys.cart(user.id) })
        qc.invalidateQueries({ queryKey: meKeys.orders(user.id), exact: true })
        setPhase('idle')
        navigate({ to: '/pedido/$orderId', params: { orderId: order.id } })
        return
      } catch (e) {
        if (isApiError(e) && e.isTransient && tryN < 2) {
          // timeout após criação: repete com a MESMA chave; o servidor devolve o pedido já criado
          setPhase('retrying')
          await new Promise((r) => setTimeout(r, 800 * (tryN + 1)))
          continue
        }
        setPhase('idle')
        handleOrderError(e, fresh.totalEth)
        return
      }
    }
  }

  const handleOrderError = (e: unknown, expectedTotal: string) => {
    if (!(e instanceof ApiError)) {
      setAlert({ tone: 'error', text: 'Não foi possível confirmar o pedido.' })
      return
    }
    const details = e.details as { quote?: Quote; reason?: string } | undefined
    if (details?.quote) applyServerQuote(details.quote)
    if (details?.reason === 'WALLET_DISCONNECTED') {
      setWallet({ status: 'disconnected', message: e.message })
      if (!useOther) setValues((v) => ({ ...v, walletAddress: '' }))
    }
    if (e.code === 'SESSION_EXPIRED' || e.code === 'UNAUTHORIZED') {
      setAlert({ tone: 'error', text: 'Sua sessão expirou. Entre novamente: seus dados do formulário foram mantidos.' })
      return
    }
    if (e.code === 'PRICE_CHANGED' && details?.quote)
      setAlert({
        tone: 'info',
        text: `O total mudou de ${formatEth(expectedTotal)} para ${formatEth(details.quote.totalEth)}. Revise e confirme novamente.`,
      })
    else setAlert({ tone: 'error', text: e.message })
  }

  const lines = quote.data?.lines ?? []
  const phaseLabel =
    phase === 'revalidating' ? 'Revalidando preços e estoque…' : phase === 'submitting' ? 'Enviando pedido…' : phase === 'retrying' ? 'Resposta demorou; verificando o pedido com a mesma chave…' : null

  return (
    <div className="container-k pt-6">
      <nav aria-label="Trilha de navegação" className="text-sm font-semibold">
        <Link to="/" className="hover:text-primary">Início</Link> /{' '}
        <Link to="/mercado" className="hover:text-primary">Mercado</Link> /{' '}
        <Link to="/carrinho" className="hover:text-primary">Carrinho</Link> / <span aria-current="page">Pagamento</span>
      </nav>
      <h1 className="sr-only">Pagamento</h1>

      <form noValidate onSubmit={submit} className="mt-5 grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        <fieldset disabled={busy} className="min-w-0">
          <legend className="mb-4 text-lg font-bold">Perfil do colecionador</legend>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Field id={`${uid}-dn`} label="Nome de exibição *" error={errors.displayName}>
              {(p) => <input {...p} value={values.displayName} onChange={set('displayName')} autoComplete="name" className={inputCls} />}
            </Field>
            <Field id={`${uid}-un`} label="Nome de usuário *" error={errors.username}>
              {(p) => <input {...p} value={values.username} onChange={set('username')} autoComplete="username" className={inputCls} />}
            </Field>
            <Field id={`${uid}-net`} label="Rede *" error={errors.network}>
              {(p) => (
                <select {...p} value={values.network} onChange={set('network')} className={inputCls}>
                  <option value="">Selecione uma rede</option>
                  {NETWORKS.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field id={`${uid}-pn`} label="Nome do perfil *" error={errors.profileName}>
              {(p) => <input {...p} value={values.profileName} onChange={set('profileName')} className={inputCls} />}
            </Field>
            <Field
              id={`${uid}-addr`}
              label="Endereço da carteira *"
              error={errors.walletAddress}
              hint={useOther ? 'Informe o endereço 0x que receberá os NFTs.' : 'Preenchido ao conectar a carteira.'}
            >
              {(p) => (
                <input
                  {...p}
                  value={values.walletAddress}
                  onChange={set('walletAddress')}
                  readOnly={!useOther}
                  placeholder="Endereço 0x da carteira"
                  spellCheck={false}
                  className={cn(inputCls, 'font-mono text-xs', !useOther && 'cursor-not-allowed opacity-80')}
                />
              )}
            </Field>
            <Field id={`${uid}-sec`} label="Carteira secundária (opcional)" error={errors.secondaryWallet}>
              {(p) => <input {...p} value={values.secondaryWallet} onChange={set('secondaryWallet')} placeholder="ENS ou carteira secundária" className={inputCls} />}
            </Field>
            <Field id={`${uid}-wt`} label="Tipo de carteira *" error={errors.walletType}>
              {(p) => (
                <select {...p} value={values.walletType} onChange={(e) => chooseWallet(e.target.value as WalletType)} className={inputCls}>
                  <option value="">Selecione uma carteira</option>
                  {WALLETS.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field id={`${uid}-ref`} label="Código de indicação (opcional)" error={errors.referralCode}>
              {(p) => <input {...p} value={values.referralCode} onChange={set('referralCode')} className={inputCls} />}
            </Field>
            <Field id={`${uid}-em`} label="E-mail *" error={errors.email}>
              {(p) => <input {...p} type="email" value={values.email} onChange={set('email')} autoComplete="email" className={inputCls} />}
            </Field>
            <Field id={`${uid}-ens`} label="Nome ENS *" error={errors.ensName}>
              {(p) => (
                <div className="flex">
                  <input {...p} value={values.ensName} onChange={set('ensName')} className={cn(inputCls, 'rounded-r-none')} />
                  <span className="grid h-10 place-items-center rounded-r-sm border border-l-0 border-input px-3 text-sm">.eth</span>
                </div>
              )}
            </Field>
          </div>
          <label className="mt-5 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useOther}
              onChange={(e) => {
                setUseOther(e.target.checked)
                setValues((v) => ({ ...v, walletAddress: e.target.checked ? '' : wallet.status === 'connected' ? wallet.address : '' }))
              }}
              className="size-4 accent-[var(--primary)]"
            />
            Usar outra carteira para receber os NFTs?
          </label>
          <div className="mt-5 max-w-lg">
            <Field id={`${uid}-note`} label="Observação do colecionador (opcional)" error={errors.note}>
              {(p) => <textarea {...p} value={values.note} onChange={set('note')} rows={5} className={cn(inputCls, 'h-auto py-2')} />}
            </Field>
          </div>
        </fieldset>

        <aside aria-labelledby="your-nfts" className="lg:sticky lg:top-20 lg:self-start">
          <h2 id="your-nfts" className="text-lg font-bold">
            Seus NFTs
          </h2>
          <div className="mt-2 flex justify-between border-b border-border pb-2 text-sm font-semibold" aria-hidden>
            <span>NFTs</span>
            <span>Subtotal</span>
          </div>
          <ul className="mt-3 space-y-2">
            {lines.map((l) => (
              <li key={`${l.nftId}-${l.editionId}`} className="flex items-center gap-3 bg-card pr-3">
                <img src={l.thumb} alt="" width={64} height={64} className="size-16 object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{l.name}</p>
                  <p className="text-xs text-muted-foreground">ID do token: {l.tokenId}</p>
                </div>
                <span className="text-xs">(x {l.quantity})</span>
                <span className="font-semibold text-primary">{formatEth(l.lineTotalEth)}</span>
              </li>
            ))}
          </ul>
          {!cart.coupon && (
            <p className="mt-3 text-center text-sm">
              Tem um código promocional?{' '}
              <Link to="/carrinho" className="text-primary hover:underline">
                Aplique aqui
              </Link>
            </p>
          )}
          <Summary quote={quote.data} loading={quote.isPending} networkPending={!values.network} />

          <fieldset disabled={busy} className="mt-6">
            <legend className="mb-3 w-full text-center font-bold">Carteira e rede</legend>
            <div className="mb-3 flex justify-center">
              <WalletsBadge />
            </div>
            <div role="radiogroup" aria-label="Carteira" className="grid gap-3">
              {WALLETS.map((w) => (
                <label
                  key={w.id}
                  className="flex cursor-pointer items-center gap-3 rounded-sm border border-border px-4 py-3 has-checked:border-primary has-focus-visible:outline-2 has-focus-visible:outline-ring"
                >
                  <input
                    type="radio"
                    name="wallet"
                    value={w.id}
                    checked={values.walletType === w.id}
                    onChange={() => chooseWallet(w.id)}
                    className="size-4 accent-[var(--primary)]"
                  />
                  {w.label}
                  {wallet.status === 'connected' && wallet.walletType === w.id && (
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-primary">
                      <CheckCircle2Icon className="size-4" aria-hidden /> Conectada
                    </span>
                  )}
                </label>
              ))}
            </div>
            <WalletStatus wallet={wallet} onConnect={doConnect} canConnect={!!values.walletType} />
          </fieldset>

          <div aria-live="assertive" className="mt-4 space-y-2">
            {alert && alert.kind === 'validation' && Object.keys(errors).length > 0 && (
              <p role="alert" className="flex gap-2 rounded-sm border border-destructive/60 px-3 py-2 text-sm text-destructive">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                Corrija {Object.keys(errors).length} campo(s) destacado(s) para continuar.
              </p>
            )}
            {alert && alert.kind !== 'validation' && (
              <p
                role="alert"
                className={cn(
                  'flex gap-2 rounded-sm border px-3 py-2 text-sm',
                  alert.tone === 'error' ? 'border-destructive/60 text-destructive' : 'border-primary/60 text-primary',
                )}
              >
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {alert.text}{' '}
                  {alert.text.includes('indisponíveis') && (
                    <Link to="/carrinho" className="underline">
                      Ir para o carrinho
                    </Link>
                  )}
                </span>
              </p>
            )}
            {phaseLabel && (
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" aria-hidden /> {phaseLabel}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={busy || !quote.data || quote.isFetching}
            aria-busy={busy}
            className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-primary font-semibold text-primary-foreground hover:bg-primary/85 disabled:opacity-60"
          >
            {busy && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
            Confirmar compra
          </button>
        </aside>
      </form>
    </div>
  )
}

function WalletStatus({ wallet, onConnect, canConnect }: { wallet: WalletState; onConnect: () => void; canConnect: boolean }) {
  return (
    <div className="mt-3 text-sm" aria-live="polite">
      {wallet.status === 'connected' ? (
        <p className="text-muted-foreground">
          Conectada: <span className="font-mono text-xs text-foreground">{wallet.address.slice(0, 8)}…{wallet.address.slice(-6)}</span>
        </p>
      ) : (
        <>
          {(wallet.status === 'rejected' || wallet.status === 'disconnected') && (
            <p role="alert" className="mb-2 text-destructive">
              {wallet.message}
            </p>
          )}
          <button
            type="button"
            onClick={onConnect}
            disabled={wallet.status === 'connecting'}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-sm border border-primary text-primary hover:bg-secondary disabled:opacity-60"
          >
            {wallet.status === 'connecting' ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : <PlugZapIcon className="size-4" aria-hidden />}
            {wallet.status === 'connecting'
              ? 'Aguardando aprovação na carteira…'
              : wallet.status === 'idle'
                ? canConnect
                  ? 'Conectar carteira'
                  : 'Selecione e conecte uma carteira'
                : 'Tentar conectar novamente'}
          </button>
        </>
      )}
    </div>
  )
}
