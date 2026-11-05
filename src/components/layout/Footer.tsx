import { useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { FOCUSED_MOBILE_ROUTES } from '@/lib/mobile-routes'
import { toast } from 'sonner'
import { FacebookIcon, InstagramIcon, LinkedinIcon, TwitterIcon } from '@/components/brand-icons'
import { YoutubeFigmaIcon } from '@/components/figma-icons'
import { comingSoon } from '@/lib/coming-soon'
import { useRealtimeStatus } from '@/features/realtime/realtime-client'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const SOCIAL = [
  { label: 'Facebook', href: 'https://www.facebook.com', Icon: FacebookIcon },
  { label: 'Instagram', href: 'https://www.instagram.com', Icon: InstagramIcon },
  { label: 'X (Twitter)', href: 'https://x.com', Icon: TwitterIcon },
  { label: 'LinkedIn', href: 'https://www.linkedin.com', Icon: LinkedinIcon },
  { label: 'YouTube', href: 'https://www.youtube.com', Icon: YoutubeFigmaIcon },
]

const linkCls = 'text-sm text-foreground/90 hover:text-primary'

function Soon({ children }: { children: string }) {
  return (
    <button type="button" className={`${linkCls} text-left`} aria-disabled="true" onClick={() => comingSoon(children)}>
      {children}
    </button>
  )
}

export function WalletsBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-sm border border-primary/40 bg-band px-2 py-1 text-[9px] font-bold tracking-wider text-primary">
      METAMASK <span aria-hidden>•</span> WALLETCONNECT <span aria-hidden>•</span> COINBASE
    </span>
  )
}

export function Footer() {
  const path = useRouterState({ select: (s) => s.location.pathname })
  const focused = FOCUSED_MOBILE_ROUTES.test(path)
  return (
    <footer className={`container-k mt-20 pb-32 md:pb-6 ${focused ? 'max-md:hidden' : ''}`}>
      <div className="bg-card">
        <div className="grid gap-8 p-6 md:grid-cols-2 md:p-8 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.letter} className="lg:border-r lg:border-primary/60 lg:pr-6">
              <span className="grid size-12 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground" aria-hidden>
                {f.letter}
              </span>
              <h2 className="mt-3 font-bold">{f.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{f.text}</p>
            </div>
          ))}
          <Newsletter />
        </div>
        <div className="grid gap-3 bg-band px-6 py-5 text-sm sm:grid-cols-2 md:px-8 lg:grid-cols-4 lg:items-center">
          <span className="font-bold tracking-[0.2em]">KURIO</span>
          <span>Feito para colecionadores, criadores e cultura</span>
          <a href="mailto:contato@email.com" className="hover:text-primary">
            contato@email.com
          </a>
          <a href="tel:+551140028922" className="hover:text-primary">
            +55 11 4002 8922
          </a>
        </div>
        <div className="grid gap-8 px-6 py-8 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
          <nav aria-label="Meu perfil" className="flex flex-col gap-2">
            <h2 className="mb-1 font-bold">Meu perfil</h2>
            <Link to="/perfil" className={linkCls}>
              Meu perfil
            </Link>
            <Soon>Minha coleção</Soon>
            <Soon>Atividade</Soon>
            <Soon>Estúdio do criador</Soon>
            <Soon>Lista de interesse</Soon>
          </nav>
          <nav aria-label="Central de ajuda" className="flex flex-col gap-2">
            <h2 className="mb-1 font-bold">Central de ajuda</h2>
            <Soon>Central de ajuda</Soon>
            <Soon>Como comprar NFTs</Soon>
            <Soon>Carteira e segurança</Soon>
            <Soon>Política do mercado</Soon>
            <Soon>Denunciar item</Soon>
          </nav>
          <nav aria-label="Coleções" className="flex flex-col gap-2">
            <h2 className="mb-1 font-bold">Coleções</h2>
            {(
              [
                ['arte-digital', 'Arte digital'],
                ['fotografia', 'Fotografia'],
                ['musica', 'Música'],
                ['arte-3d', 'Arte 3D'],
                ['utilidade', 'Utilidade'],
              ] as const
            ).map(([id, label]) => (
              <Link key={id} to="/mercado" search={{ category: id }} className={linkCls}>
                {label}
              </Link>
            ))}
          </nav>
          <div>
            <h2 className="mb-3 font-bold">Redes sociais</h2>
            <ul className="flex gap-2">
              {SOCIAL.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${label} (abre em nova aba)`}
                    className="grid size-8 place-items-center rounded-sm border border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    <Icon />
                  </a>
                </li>
              ))}
            </ul>
            <h2 className="mt-6 mb-2 font-bold">Carteiras compatíveis</h2>
            <WalletsBadge />
          </div>
        </div>
      </div>
      <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-xs">
        <span>© 2026 Kurio. Propriedade digital para todos.</span>
        <RealtimeBadge />
      </p>
    </footer>
  )
}

function Newsletter() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setError('Informe um e-mail válido.')
          return
        }
        setError(null)
        toast.info('A inscrição na newsletter não está disponível nesta versão.')
      }}
    >
      <h2 className="font-bold leading-tight">Antecipe-se ao próximo lançamento</h2>
      <div className="mt-3 flex">
        <label htmlFor="newsletter-email" className="sr-only">
          E-mail para newsletter
        </label>
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="digite seu e-mail..."
          aria-invalid={!!error}
          aria-describedby={error ? 'newsletter-error' : undefined}
          className="h-9 min-w-0 flex-1 rounded-l-sm bg-secondary px-3 text-sm placeholder:text-muted-foreground"
        />
        <button type="submit" className="h-9 rounded-r-sm bg-primary px-3 font-bold text-primary-foreground hover:bg-primary/85">
          Enviar
        </button>
      </div>
      {error && (
        <p id="newsletter-error" role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
      </p>
    </form>
  )
}

function RealtimeBadge() {
  const status = useRealtimeStatus()
  const label = status === 'connected' ? 'Preços ao vivo' : status === 'connecting' ? 'Conectando…' : 'Reconectando…'
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground" data-testid="realtime-status" data-status={status}>
      <span
        aria-hidden
        className={`size-2 rounded-full ${status === 'connected' ? 'bg-emerald-400' : 'animate-pulse bg-amber-400'}`}
      />
      {label}
    </span>
  )
}
