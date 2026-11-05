import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isApiError } from '@/api/client'
import { meKeys } from '@/api/me'
import { createWallet, updateWallet, walletsQuery, type WalletInput } from '@/api/profile'
import { NETWORKS, type Wallet } from '@/api/types'
import { Field, inputCls, SubmitButton } from '@/features/auth/AuthDialog'
import { useUser } from '@/features/auth/session-store'
import { WALLETS } from '@/features/checkout/wallets'
import { cn } from '@/lib/utils'

export function WalletsPage() {
  const user = useUser()!
  const { data, isPending, isError, refetch } = useQuery(walletsQuery(user.id))
  const [addingPrimary, setAddingPrimary] = useState(false)
  const [addingSecondary, setAddingSecondary] = useState(false)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)

  if (isPending) return <div className="shimmer h-[520px] rounded-sm" aria-busy="true" aria-label="Carregando carteiras" />
  if (isError)
    return (
      <div role="alert" className="rounded-sm border border-destructive/50 p-6 text-center">
        Não foi possível carregar suas carteiras.{' '}
        <button type="button" className="text-primary underline" onClick={() => refetch()}>
          Tentar novamente
        </button>
      </div>
    )

  const primary = data.find((w) => w.kind === 'primary')
  const secondary = data.find((w) => w.kind === 'secondary')

  return (
    <div className="space-y-12">
      <section aria-labelledby="primary-title">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="primary-title" className="text-lg font-bold">
              Carteira principal
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          </div>
          {!primary && !addingPrimary && (
            <button type="button" onClick={() => setAddingPrimary(true)} className="font-semibold text-primary hover:underline">
              Adicionar
            </button>
          )}
        </div>
        {primary || addingPrimary ? (
          <WalletForm
            key={primary?.id ?? 'new-primary'}
            kind="primary"
            wallet={primary}
            defaults={{ displayName: user.displayName, email: user.email, ensName: user.ensName, profileName: user.displayName }}
            onDone={() => setAddingPrimary(false)}
          />
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Você ainda não adicionou uma carteira principal.</p>
        )}
      </section>

      <section aria-labelledby="secondary-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="secondary-title" className="text-lg font-bold">
              Carteira secundária
            </h2>
            {!secondary && !addingSecondary && (
              <p className="mt-1 text-sm text-muted-foreground">Você ainda não adicionou uma carteira secundária.</p>
            )}
          </div>
          {!secondary && (
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sameAsPrimary}
                  disabled={!primary}
                  onChange={(e) => {
                    setSameAsPrimary(e.target.checked)
                    if (e.target.checked) setAddingSecondary(true)
                  }}
                  className="size-4 accent-[var(--primary)]"
                />
                Igual à carteira principal
              </label>
              {!addingSecondary && (
                <button type="button" onClick={() => setAddingSecondary(true)} className="font-semibold text-primary hover:underline">
                  Adicionar
                </button>
              )}
            </div>
          )}
        </div>
        {(secondary || addingSecondary) && (
          <WalletForm
            key={secondary?.id ?? `new-secondary-${sameAsPrimary}`}
            kind="secondary"
            wallet={secondary}
            // "igual à principal" copia os dados; o endereço precisa ser outro (o servidor valida duplicidade)
            defaults={
              sameAsPrimary && primary
                ? { ...primary, address: '', nickname: `${primary.nickname} (secundária)` }
                : { displayName: user.displayName, email: user.email, ensName: user.ensName, profileName: user.displayName }
            }
            onDone={() => {
              setAddingSecondary(false)
              setSameAsPrimary(false)
            }}
          />
        )}
      </section>
    </div>
  )
}

const EMPTY: WalletInput = {
  kind: 'primary',
  displayName: '',
  nickname: '',
  network: 'ethereum',
  profileName: '',
  address: '',
  secondaryAddress: '',
  walletType: 'metamask',
  referralCode: '',
  email: '',
  ensName: '',
}

function validate(v: WalletInput) {
  const e: Record<string, string> = {}
  if (v.displayName.trim().length < 2) e.displayName = 'Informe o nome de exibição.'
  if (v.nickname.trim().length < 2) e.nickname = 'Informe o apelido da carteira.'
  if (!v.network) e.network = 'Selecione uma rede.'
  if (v.profileName.trim().length < 2) e.profileName = 'Informe o nome do perfil.'
  if (!/^0x[a-fA-F0-9]{40}$/.test(v.address.trim())) e.address = 'Endereço inválido: use 0x seguido de 40 caracteres hexadecimais.'
  if (v.secondaryAddress && !/^0x[a-fA-F0-9]{40}$/.test(v.secondaryAddress.trim()) && !/^[a-z0-9-]+\.eth$/i.test(v.secondaryAddress.trim()))
    e.secondaryAddress = 'Use um endereço 0x ou um nome .eth.'
  if (!v.walletType) e.walletType = 'Selecione o tipo de carteira.'
  if (v.referralCode && !/^[A-Z0-9-]{4,16}$/i.test(v.referralCode.trim())) e.referralCode = 'Código de indicação inválido.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = 'Informe um e-mail válido.'
  if (!/^[a-z0-9-]{3,32}$/i.test(v.ensName.trim())) e.ensName = 'Use 3 a 32 letras, números ou hífen.'
  return e
}

function WalletForm({
  kind,
  wallet,
  defaults,
  onDone,
}: {
  kind: Wallet['kind']
  wallet?: Wallet
  defaults: Partial<WalletInput>
  onDone: () => void
}) {
  const uid = useId()
  const user = useUser()!
  const qc = useQueryClient()
  const [values, setValues] = useState<WalletInput>(() => {
    if (wallet) {
      const { id: _id, ...rest } = wallet
      return rest
    }
    const { id: _id, ...d } = defaults as Partial<Wallet>
    return { ...EMPTY, ...d, kind }
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: keyof WalletInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }))
    if (errors[k]) setErrors(({ [k]: _drop, ...rest }) => rest)
  }

  const save = useMutation({
    mutationFn: (v: WalletInput) => (wallet ? updateWallet(wallet.id, v) : createWallet(v)),
    onSuccess: (saved) => {
      qc.setQueryData<Wallet[]>(meKeys.wallets(user.id), (old = []) =>
        old.some((w) => w.id === saved.id) ? old.map((w) => (w.id === saved.id ? saved : w)) : [...old, saved],
      )
      toast.success(wallet ? 'Carteira atualizada.' : 'Carteira adicionada.')
      onDone()
    },
    onError: (e) => {
      if (isApiError(e) && e.fields) setErrors(e.fields)
      toast.error(isApiError(e) ? e.message : 'Não foi possível salvar a carteira.')
    },
  })

  return (
    <form
      noValidate
      className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2"
      aria-label={kind === 'primary' ? 'Dados da carteira principal' : 'Dados da carteira secundária'}
      onSubmit={(ev) => {
        ev.preventDefault()
        const e = validate(values)
        setErrors(e)
        if (Object.keys(e).length) {
          requestAnimationFrame(() => (ev.currentTarget.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus())
          return
        }
        save.mutate(values)
      }}
    >
      <Field id={`${uid}-dn`} label="Nome de exibição" required error={errors.displayName}>
        {(p) => <input {...p} value={values.displayName} onChange={set('displayName')} className={inputCls} />}
      </Field>
      <Field id={`${uid}-nick`} label="Apelido da carteira" required error={errors.nickname}>
        {(p) => <input {...p} value={values.nickname} onChange={set('nickname')} className={inputCls} />}
      </Field>
      <Field id={`${uid}-net`} label="Rede" required error={errors.network}>
        {(p) => (
          <select {...p} value={values.network} onChange={set('network')} className={inputCls}>
            {NETWORKS.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field id={`${uid}-pn`} label="Nome do perfil" required error={errors.profileName}>
        {(p) => <input {...p} value={values.profileName} onChange={set('profileName')} className={inputCls} />}
      </Field>
      <Field id={`${uid}-addr`} label="Endereço da carteira" required error={errors.address}>
        {(p) => (
          <input {...p} value={values.address} onChange={set('address')} placeholder="Endereço 0x da carteira" spellCheck={false} className={cn(inputCls, 'font-mono text-xs')} />
        )}
      </Field>
      <Field id={`${uid}-sec`} label="ENS ou carteira secundária (opcional)" error={errors.secondaryAddress}>
        {(p) => <input {...p} value={values.secondaryAddress} onChange={set('secondaryAddress')} className={inputCls} />}
      </Field>
      <Field id={`${uid}-wt`} label="Tipo de carteira" required error={errors.walletType}>
        {(p) => (
          <select {...p} value={values.walletType} onChange={set('walletType')} className={inputCls}>
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
      <Field id={`${uid}-em`} label="E-mail" required error={errors.email}>
        {(p) => <input {...p} type="email" value={values.email} onChange={set('email')} className={inputCls} />}
      </Field>
      <Field id={`${uid}-ens`} label="Nome ENS" required error={errors.ensName}>
        {(p) => (
          <div className="flex">
            <span className="grid h-10 place-items-center rounded-l-sm border border-r-0 border-input px-3 text-sm">.eth</span>
            <input {...p} value={values.ensName} onChange={set('ensName')} className={cn(inputCls, 'rounded-l-none')} />
          </div>
        )}
      </Field>
      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <SubmitButton loading={save.isPending} className="w-full sm:w-48">
          Salvar carteira
        </SubmitButton>
        {!wallet && (
          <button type="button" onClick={onDone} className="h-11 px-4 text-sm hover:text-primary">
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
