import { useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImageIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { isApiError } from '@/api/client'
import { meKeys } from '@/api/me'
import { changePassword, profileQuery, removeAvatar, syncSessionUser, updateProfile, uploadAvatar, type ProfileInput } from '@/api/profile'
import type { User } from '@/api/types'
import { Field, inputCls, PasswordInput, SubmitButton } from '@/features/auth/AuthDialog'
import { useUser } from '@/features/auth/session-store'
import { cn } from '@/lib/utils'

export function ProfilePage() {
  const user = useUser()!
  const { data, isPending, isError, refetch } = useQuery(profileQuery(user.id))
  if (isPending) return <div className="shimmer h-[520px] rounded-sm" aria-busy="true" aria-label="Carregando perfil" />
  if (isError)
    return (
      <div role="alert" className="rounded-sm border border-destructive/50 p-6 text-center">
        Não foi possível carregar o perfil.{' '}
        <button type="button" className="text-primary underline" onClick={() => refetch()}>
          Tentar novamente
        </button>
      </div>
    )
  return (
    <ProfileForm key={data.id + data.username + data.email} profile={data} />
  )
}

function onSaved(qc: ReturnType<typeof useQueryClient>, user: User) {
  qc.setQueryData(meKeys.profile(user.id), user)
  syncSessionUser(user)
}

type Passwords = { current: string; next: string; confirm: string }

function ProfileForm({ profile }: { profile: User }) {
  const uid = useId()
  const qc = useQueryClient()
  const [values, setValues] = useState<ProfileInput>({
    displayName: profile.displayName,
    username: profile.username,
    email: profile.email,
    ensName: profile.ensName,
    walletNickname: profile.walletNickname,
  })
  const [pw, setPw] = useState<Passwords>({ current: '', next: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const clear = (k: string) => errors[k] && setErrors(({ [k]: _drop, ...rest }) => rest)
  const set = (k: keyof ProfileInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }))
    clear(k)
  }
  const setP = (k: keyof Passwords) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setPw((v) => ({ ...v, [k]: e.target.value }))
    clear(`pw_${k}`)
  }
  const wantsPassword = !!(pw.current || pw.next || pw.confirm)

  /** Um único "Salvar": grava os dados e, se os campos de senha foram preenchidos, troca a senha. */
  const save = useMutation({
    mutationFn: async () => {
      const user = await updateProfile(values)
      onSaved(qc, user)
      if (wantsPassword) {
        try {
          await changePassword(pw.current, pw.next)
        } catch (e) {
          throw Object.assign(e as object, { stage: 'password' })
        }
      }
    },
    onSuccess: () => {
      setPw({ current: '', next: '', confirm: '' })
      toast.success(wantsPassword ? 'Perfil e senha atualizados.' : 'Perfil atualizado.')
    },
    onError: (e) => {
      const stage = (e as { stage?: string }).stage
      if (isApiError(e) && e.fields) {
        setErrors(
          stage === 'password'
            ? {
                ...(e.fields.currentPassword && { pw_current: e.fields.currentPassword }),
                ...(e.fields.newPassword && { pw_next: e.fields.newPassword }),
              }
            : e.fields,
        )
      }
      const msg = isApiError(e) ? e.message : 'Não foi possível salvar.'
      toast.error(stage === 'password' ? `Dados salvos, mas a senha não foi alterada: ${msg}` : msg)
    },
  })

  const validate = () => {
    const e: Record<string, string> = {}
    if (values.displayName.trim().length < 2) e.displayName = 'Informe o nome de exibição.'
    if (!/^[a-z0-9_.]{3,20}$/i.test(values.username.trim())) e.username = 'Use 3 a 20 letras, números, _ ou .'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) e.email = 'Informe um e-mail válido.'
    if (!/^[a-z0-9-]{3,32}$/i.test(values.ensName.trim())) e.ensName = 'Use 3 a 32 letras, números ou hífen.'
    if (values.walletNickname.trim().length < 2) e.walletNickname = 'Informe o apelido da carteira.'
    if (wantsPassword) {
      if (!pw.current) e.pw_current = 'Informe a senha atual.'
      if (pw.next.length < 8) e.pw_next = 'A senha precisa ter ao menos 8 caracteres.'
      else if (!/[A-Za-z]/.test(pw.next) || !/\d/.test(pw.next)) e.pw_next = 'Use letras e números na senha.'
      if (pw.confirm !== pw.next) e.pw_confirm = 'As senhas não conferem.'
    }
    return e
  }

  return (
    <form
      noValidate
      aria-labelledby={`${uid}-title`}
      onSubmit={(ev) => {
        ev.preventDefault()
        const e = validate()
        setErrors(e)
        if (Object.keys(e).length) {
          requestAnimationFrame(() => (document.querySelector('main [aria-invalid="true"]') as HTMLElement | null)?.focus())
          return
        }
        save.mutate()
      }}
    >
      <h2 id={`${uid}-title`} className="mb-5 text-lg font-bold">
        Perfil do colecionador
      </h2>
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <Field id={`${uid}-dn`} label="Nome de exibição *" error={errors.displayName}>
          {(p) => <input {...p} value={values.displayName} onChange={set('displayName')} autoComplete="name" className={inputCls} />}
        </Field>
        <Field id={`${uid}-un`} label="Nome de usuário *" error={errors.username}>
          {(p) => <input {...p} value={values.username} onChange={set('username')} autoComplete="username" className={inputCls} />}
        </Field>
        <Field id={`${uid}-em`} label="E-mail *" error={errors.email}>
          {(p) => <input {...p} type="email" value={values.email} onChange={set('email')} autoComplete="email" className={inputCls} />}
        </Field>
        <Field id={`${uid}-ens`} label="Nome ENS *" error={errors.ensName}>
          {(p) => (
            <div className="flex">
              <span className="grid h-10 place-items-center rounded-l-sm border border-r-0 border-input px-3 text-sm">.eth</span>
              <input {...p} value={values.ensName} onChange={set('ensName')} className={cn(inputCls, 'rounded-l-none')} />
            </div>
          )}
        </Field>
        <Field id={`${uid}-wn`} label="Apelido da carteira *" error={errors.walletNickname}>
          {(p) => <input {...p} value={values.walletNickname} onChange={set('walletNickname')} className={inputCls} />}
        </Field>
        <AvatarField profile={profile} />
      </div>

      <fieldset className="mt-10 grid max-w-md gap-5">
        <legend className="mb-5 text-lg font-bold">Alterar senha</legend>
        <p className="-mt-3 text-xs text-muted-foreground">Preencha apenas se quiser trocar sua senha.</p>
        <Field id={`${uid}-cur`} label="Senha atual" error={errors.pw_current}>
          {(p) => <PasswordInput {...p} autoComplete="current-password" value={pw.current} onChange={setP('current')} />}
        </Field>
        <Field id={`${uid}-new`} label="Nova senha" error={errors.pw_next} hint="Mínimo de 8 caracteres, com letras e números.">
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={pw.next} onChange={setP('next')} />}
        </Field>
        <Field id={`${uid}-conf`} label="Confirmar nova senha" error={errors.pw_confirm}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={pw.confirm} onChange={setP('confirm')} />}
        </Field>
      </fieldset>

      <SubmitButton loading={save.isPending} className="mt-8 w-full sm:w-44">
        Salvar
      </SubmitButton>
    </form>
  )
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function AvatarField({ profile }: { profile: User }) {
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const upload = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: (u) => {
      onSaved(qc, u)
      setError(null)
      toast.success('Avatar atualizado.')
    },
    onError: (e) => setError(isApiError(e) ? e.message : 'Falha ao enviar a imagem.'),
  })
  const remove = useMutation({
    mutationFn: removeAvatar,
    onSuccess: (u) => {
      onSaved(qc, u)
      toast.success('Avatar removido.')
    },
    onError: () => toast.error('Não foi possível remover o avatar.'),
  })
  const busy = upload.isPending || remove.isPending

  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm">Avatar</legend>
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid size-16 place-items-center overflow-hidden rounded-full bg-secondary text-primary" aria-live="polite">
          {busy ? (
            <Loader2Icon className="size-6 animate-spin" aria-label="Enviando" />
          ) : profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={`Avatar de ${profile.displayName}`} width={64} height={64} className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-6" aria-label="Sem avatar" />
          )}
        </span>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          aria-label="Escolher imagem de avatar"
          aria-describedby={error ? 'avatar-error' : 'avatar-hint'}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            if (!file.type.startsWith('image/')) return setError('Escolha um arquivo de imagem.')
            if (file.size > 400 * 1024) return setError('A imagem deve ter no máximo 400 KB.')
            upload.mutate(await readAsDataUrl(file))
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="h-10 rounded-sm bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/85 disabled:opacity-60"
        >
          Alterar
        </button>
        <button
          type="button"
          disabled={busy || !profile.avatarUrl}
          onClick={() => remove.mutate()}
          className="h-10 px-2 text-sm hover:text-primary disabled:opacity-40"
        >
          Remover
        </button>
      </div>
      {error ? (
        <p id="avatar-error" role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        <p id="avatar-hint" className="text-xs text-muted-foreground">
          PNG, JPG, WEBP ou GIF até 400 KB.
        </p>
      )}
    </fieldset>
  )
}
