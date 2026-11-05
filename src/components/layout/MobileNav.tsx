import { Link } from '@tanstack/react-router'
import { HeartIcon, HouseIcon, ShoppingCartIcon, UserIcon } from 'lucide-react'
import { useCartCount } from '@/features/cart/use-cart'
import { comingSoon } from '@/lib/coming-soon'
import { ScanLineIcon } from '../figma-icons'

/**
 * Barra inferior do frame mobile (Figma "Vector" 414×95, #241612, sombra 0 -10 30 #0A0604 45%).
 * O "afundado" central é o próprio contorno da barra, desenhado em SVG: uma curva côncava sob o
 * botão central (Ellipse 39: 65×65, gradiente #D28A4C 40% → 100%), que fica 31px acima da barra.
 * O SVG estica na horizontal (preserveAspectRatio="none") para ocupar qualquer largura.
 */
const BAR_PATH =
  'M0 40 Q0 0 40 0 H146 C163 0 170 9 177 22 C186 39 195 48 207 48 C219 48 228 39 237 22 C244 9 251 0 268 0 H374 Q414 0 414 40 V95 H0 Z'

const item =
  'relative grid size-12 place-items-center text-[#d9bf9f] transition-colors hover:text-primary data-[status=active]:text-primary'

export function MobileNav() {
  const count = useCartCount()
  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-0 bottom-0 z-40 h-[95px] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <svg
        aria-hidden
        viewBox="0 0 414 95"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full drop-shadow-[0_-10px_30px_rgba(10,6,4,0.45)]"
      >
        <path d={BAR_PATH} fill="#241612" />
      </svg>

      {/* botão central: 65px, centro alinhado ao meio da curva, 31px acima da barra */}
      <button
        type="button"
        onClick={() => comingSoon('O leitor de QR code')}
        aria-label="Ler QR code de um NFT"
        className="absolute -top-[31px] left-1/2 z-10 grid size-[65px] -translate-x-1/2 place-items-center rounded-full text-[#f5f1eb] shadow-[0_6px_16px_rgba(10,6,4,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: 'linear-gradient(180deg, rgba(210, 138, 76, 0.4) -16.92%, #D28A4C 109.23%)' }}
      >
        <ScanLineIcon />
      </button>

      <div className="relative grid h-full grid-cols-[1fr_122px_1fr] items-center px-2 pt-1">
        <div className="flex justify-around">
          <Link to="/" className={item} activeOptions={{ exact: true, includeSearch: false }} aria-label="Início">
            <HouseIcon className="size-7 fill-current" strokeWidth={1.5} aria-hidden />
          </Link>
          <Link to="/perfil/favoritos" className={item} aria-label="Lista de interesse">
            <HeartIcon className="size-7 fill-current" strokeWidth={1.5} aria-hidden />
          </Link>
        </div>
        <span aria-hidden />
        <div className="flex justify-around">
          <Link to="/carrinho" className={item} aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}>
            <ShoppingCartIcon className="size-7 fill-current" strokeWidth={1.5} aria-hidden />
            {count > 0 && (
              <span className="absolute top-1 right-0 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
          <Link to="/perfil" className={item} aria-label="Meu perfil">
            <UserIcon className="size-7 fill-current" strokeWidth={1.5} aria-hidden />
          </Link>
        </div>
      </div>
    </nav>
  )
}
