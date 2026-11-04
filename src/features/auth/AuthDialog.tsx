import { useId, useState, type ReactNode } from 'react'
import { EyeIcon, EyeOffIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { isApiError } from '@/api/client'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { comingSoon } from '@/lib/coming-soon'
import { cn } from '@/lib/utils'
import { login, signup } from './auth-actions'
import { authDialog, useAuthDialog, type AuthMode } from './session-store'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AuthDialog() {
  const { open, mode, reason } = useAuthDialog()
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : authDialog.close())}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-b-8 border-primary bg-card px-6 py-8 sm:max-w-md sm:px-10">
        <div className="flex items-center justify-center gap-3 text-lg font-semibold" role="tablist" aria-label="Tipo de acesso">
          <ModeTab mode="login" current={mode} label="Entrar" />
          <span aria-hidden className="h-6 w-px bg-primary" />
          <ModeTab mode="signup" current={mode} label="Criar conta" />
        </div>
        <DialogTitle className="sr-only">{mode === 'login' ? 'Entrar na sua conta' : 'Criar conta'}</DialogTitle>
        <DialogDescription className="text-center text-sm text-foreground">
          {reason ?? 'Entre para gerenciar sua carteira, coleção e perfil de criador.'}
        </DialogDescription>
        {mode === 'login' ? <LoginForm key="login" /> : <SignupForm key="signup" />}
        <div className="relative my-2 text-center text-xs">
          <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
          <span className="relative bg-card px-3">Ou continue com</span>
        </div>
        <div className="grid gap-3">
          <button type="button" onClick={() => comingSoon('Login com Google')} className="h-10 rounded-sm border border-border text-sm hover:border-primary">
            Continuar com Google
          </button>
          <button type="button" onClick={() => comingSoon('Login com Facebook')} className="h-10 rounded-sm border border-border text-sm hover:border-primary">
            Continuar com Facebook
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ModeTab({ mode, current, label }: { mode: AuthMode; current: AuthMode; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={mode === current}
      onClick={() => authDialog.setMode(mode)}
      className="text-foreground aria-selected:text-primary"
    >
      {label}
    </button>
  )
}

export function Field({
  label,
  error,
  children,
  id,
  hint,
}: {
  label: string
  error?: string
  id: string
  hint?: string
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode
}) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export const inputCls =
  'h-10 w-full rounded-sm border border-input bg-background px-3 text-sm placeholder:text-muted-foreground/80 focus-visible:border-primary aria-invalid:border-destructive'

export function PasswordInput(props: React.ComponentProps<'input'>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={cn(inputCls, 'pr-10', props.className)} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-primary"
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={show}
      >
        {show ? <EyeIcon className="size-4" aria-hidden /> : <EyeOffIcon className="size-4" aria-hidden />}
      </button>
    </div>
  )
}

function finish(message: string) {
  toast.success(message)
  const next = authDialog.consumeAfterAuth()
  authDialog.close()
  next?.()
}

function LoginForm() {
  const uid = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  return (
    <form
      noValidate
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        const errs: Record<string, string> = {}
        if (!EMAIL.test(email.trim())) errs.email = 'Informe um e-mail válido.'
        if (!password) errs.password = 'Informe sua senha.'
        setErrors(errs)
        setFormError(null)
        if (Object.keys(errs).length) return
        setLoading(true)
        try {
          const s = await login(email.trim(), password)
          finish(`Bem-vindo de volta, ${s.user.displayName.split(' ')[0]}!`)
        } catch (err) {
          if (isApiError(err) && err.fields) setErrors(err.fields)
          setFormError(isApiError(err) ? err.message : 'Não foi possível entrar.')
        } finally {
          setLoading(false)
        }
      }}
    >
      <Field id={`${uid}-email`} label="E-mail" error={errors.email}>
        {(p) => (
          <input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@email.com" className={inputCls} />
        )}
      </Field>
      <Field id={`${uid}-password`} label="Senha" error={errors.password}>
        {(p) => <PasswordInput {...p} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <button type="button" onClick={() => comingSoon('Recuperação de senha')} className="justify-self-end text-xs text-primary hover:underline">
        Esqueceu a senha?
      </button>
      {formError && (
        <p role="alert" className="rounded-sm border border-destructive/50 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}
      <SubmitButton loading={loading}>Entrar</SubmitButton>
    </form>
  )
}

function SignupForm() {
  const uid = useId()
  const [values, setValues] = useState({ displayName: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }))

  return (
    <form
      noValidate
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        const errs: Record<string, string> = {}
        if (values.displayName.trim().length < 2) errs.displayName = 'Informe seu nome (mín. 2 caracteres).'
        if (!EMAIL.test(values.email.trim())) errs.email = 'Informe um e-mail válido.'
        if (values.password.length < 8) errs.password = 'A senha precisa ter ao menos 8 caracteres.'
        else if (!/[A-Za-z]/.test(values.password) || !/\d/.test(values.password)) errs.password = 'Use letras e números na senha.'
        if (values.confirm !== values.password) errs.confirm = 'As senhas não conferem.'
        setErrors(errs)
        setFormError(null)
        if (Object.keys(errs).length) return
        setLoading(true)
        try {
          const s = await signup(values.displayName.trim(), values.email.trim(), values.password)
          finish(`Conta criada! Bem-vindo, ${s.user.displayName.split(' ')[0]}.`)
        } catch (err) {
          if (isApiError(err) && err.fields) setErrors(err.fields)
          setFormError(isApiError(err) ? err.message : 'Não foi possível criar a conta.')
        } finally {
          setLoading(false)
        }
      }}
    >
      <Field id={`${uid}-name`} label="Nome de exibição" error={errors.displayName}>
        {(p) => <input {...p} autoComplete="name" value={values.displayName} onChange={set('displayName')} className={inputCls} />}
      </Field>
      <Field id={`${uid}-email`} label="E-mail" error={errors.email}>
        {(p) => <input {...p} type="email" autoComplete="email" value={values.email} onChange={set('email')} placeholder="contato@email.com" className={inputCls} />}
      </Field>
      <Field id={`${uid}-password`} label="Senha" error={errors.password} hint="Mínimo de 8 caracteres, com letras e números.">
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={values.password} onChange={set('password')} />}
      </Field>
      <Field id={`${uid}-confirm`} label="Confirmar senha" error={errors.confirm}>
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={values.confirm} onChange={set('confirm')} />}
      </Field>
      {formError && (
        <p role="alert" className="rounded-sm border border-destructive/50 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}
      <SubmitButton loading={loading}>Criar conta</SubmitButton>
    </form>
  )
}

export function SubmitButton({ loading, children, className }: { loading: boolean; children: ReactNode; className?: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      aria-busy={loading}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/85 disabled:opacity-60',
        className,
      )}
    >
      {loading && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}
