import { Link } from '@tanstack/react-router'
import { HouseIcon, ScanLineIcon, UserIcon } from 'lucide-react'
import { CartOutlineIcon, HeartFilledIcon } from '@/components/figma-icons'
import { useCartCount } from '@/features/cart/use-cart'
import { comingSoon } from '@/lib/coming-soon'

const item =
  'relative grid flex-1 place-items-center py-4 text-[#e8c9a6] data-[status=active]:text-primary hover:text-primary'

/** Barra inferior do frame mobile: 4 atalhos e o botão central elevado (leitor de QR). */
export function MobileNav() {
  const count = useCartCount()
  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="relative mx-auto flex h-16 items-stretch rounded-t-[28px] bg-[#241612] px-4 shadow-[0_-8px_24px_rgb(0_0_0/0.35)]">
        <Link to="/" className={item} activeOptions={{ exact: true, includeSearch: false }} aria-label="Início">
          <HouseIcon className="size-6 fill-current" aria-hidden />
        </Link>
        <Link to="/perfil/favoritos" className={item} aria-label="Lista de interesse">
          <HeartFilledIcon className="h-5 w-6" />
        </Link>
        <span className="flex-1" aria-hidden />
        <Link to="/carrinho" className={item} aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}>
          <CartOutlineIcon className="size-6" />
          {count > 0 && (
            <span className="absolute top-2.5 left-1/2 ml-1 rounded-full bg-primary px-1 text-[9px] leading-4 font-bold text-primary-foreground">
              {count}
            </span>
          )}
        </Link>
        <Link to="/perfil" className={item} aria-label="Meu perfil">
          <UserIcon className="size-6 fill-current" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={() => comingSoon('O leitor de QR code')}
          aria-label="Ler QR code de um NFT"
          className="absolute -top-7 left-1/2 grid size-16 -translate-x-1/2 place-items-center rounded-full bg-gradient-to-b from-[#e09a5c] to-[#b8703a] text-[#f5f1eb] shadow-lg ring-8 ring-background"
        >
          <ScanLineIcon className="size-7" aria-hidden />
        </button>
      </div>
    </nav>
  )
}
