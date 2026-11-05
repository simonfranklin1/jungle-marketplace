import { lazy, Suspense, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { LogIn, LogOut, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCartCount } from '@/features/cart/use-cart'
import { comingSoon } from '@/lib/coming-soon'
import { authDialog, useUser } from '@/features/auth/session-store'
import { logout } from '@/features/auth/auth-actions'
import { CartIcon } from '../figma-icons'

// o diálogo de busca (Base UI) só é baixado quando aberto
const SearchDialog = lazy(() => import('./SearchDialog').then((m) => ({ default: m.SearchDialog })))

const navLink =
  'relative py-2 text-sm text-foreground transition-colors hover:text-primary data-[status=active]:font-semibold data-[status=active]:text-primary data-[status=active]:after:absolute data-[status=active]:after:inset-x-0 data-[status=active]:after:-bottom-[5px] data-[status=active]:after:h-0.5 data-[status=active]:after:bg-primary'

export function Header() {
  const [searchOpen, setSearchOpen] = useState(false)
  const count = useCartCount()

  return (
    <header className="sticky top-0 z-40 hidden bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 md:block">
      <div className="container-k pt-6">
        <div className="flex h-[45px] items-center justify-between gap-4 border-b border-border">
          <Link to="/" className="text-sm font-bold tracking-[0.2em]" aria-label="Kurio, página inicial">
            KURIO
          </Link>

          <nav aria-label="Principal" className="hidden items-center gap-10 md:flex">
            <Link to="/" className={navLink} activeOptions={{ exact: true, includeSearch: false }}>
              Início
            </Link>
            <Link to="/mercado" className={navLink} activeOptions={{ includeSearch: false }}>
              Mercado
            </Link>
            <button type="button" className={navLink} aria-disabled="true" onClick={() => comingSoon('Criadores')}>
              Criadores
            </button>
            <button type="button" className={navLink} aria-disabled="true" onClick={() => comingSoon('Aprenda')}>
              Aprenda
            </button>
          </nav>

          <div className="flex items-center gap-3 sm:gap-5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="grid size-9 place-items-center rounded-md hover:text-primary"
              aria-label="Buscar NFTs"
            >
              <SearchIcon className="size-5" aria-hidden />
            </button>
            <Link
              to="/carrinho"
              className="relative grid size-9 place-items-center rounded-md hover:text-primary"
              aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
            >
              <CartIcon className="size-5" aria-hidden />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground">
                  {count}
                </span>
              )}
            </Link>
            <AccountButton />
          </div>
        </div>
      </div>
      {searchOpen && (
        <Suspense fallback={null}>
          <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
        </Suspense>
      )}
    </header>
  )
}

function AccountButton() {
  const user = useUser()
  if (!user)
    return (
      <Button size="sm" className="h-8 gap-1.5 px-3 font-semibold" onClick={() => authDialog.open('login')}>
        <LogIn aria-hidden /> <span className="hidden sm:inline">Entrar</span>
        <span className="sr-only sm:hidden">Entrar</span>
      </Button>
    )
  return (
    <div className="flex items-center gap-2">
      <Link
        to="/perfil"
        className="flex items-center gap-2 rounded-sm px-1 text-sm hover:text-primary"
        aria-label={`Meu perfil (${user.displayName})`}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" width={32} height={32} className="size-8 rounded-full object-cover" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-primary font-bold text-primary-foreground" aria-hidden>
            {user.displayName.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="hidden max-w-28 truncate lg:inline">{user.displayName.split(' ')[0]}</span>
      </Link>
      <button
        type="button"
        onClick={() => void logout()}
        className="hidden size-8 place-items-center rounded-sm hover:text-primary sm:grid"
        aria-label="Sair da conta"
        title="Sair"
      >
        <LogOut className="size-4" aria-hidden />
      </button>
    </div>
  )
}
