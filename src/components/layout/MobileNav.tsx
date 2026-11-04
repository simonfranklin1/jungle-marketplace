import { Link } from '@tanstack/react-router'
import { LayoutGridIcon, HouseIcon, ShoppingCart, UserIcon } from 'lucide-react'
import { useCartCount } from '@/features/cart/use-cart'

const item =
  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-subtle data-[status=active]:text-primary hover:text-primary'

export function MobileNav() {
  const count = useCartCount()
  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-0 bottom-0 z-40 flex rounded-t-3xl border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <Link to="/" className={item} activeOptions={{ exact: true, includeSearch: false }}>
        <HouseIcon className="size-5" aria-hidden />
        Início
      </Link>
      <Link to="/mercado" className={item} activeOptions={{ includeSearch: false }}>
        <LayoutGridIcon className="size-5" aria-hidden />
        Mercado
      </Link>
      <Link to="/carrinho" className={item}>
        <span className="relative">
          <ShoppingCart className="size-5" aria-hidden />
          {count > 0 && (
            <span className="absolute -top-1.5 -right-2 rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {count}
            </span>
          )}
        </span>
        Carrinho
      </Link>
      <Link to="/perfil" className={item}>
        <UserIcon className="size-5" aria-hidden />
        Perfil
      </Link>
    </nav>
  )
}
