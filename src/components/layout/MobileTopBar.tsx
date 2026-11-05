import { useRouter, useRouterState } from '@tanstack/react-router'
import { ChevronLeftIcon } from 'lucide-react'

const TITLES: Array<[RegExp, string]> = [
  [/^\/mercado/, 'Mercado'],
  [/^\/carrinho/, 'Carrinho de NFTs'],
  [/^\/checkout/, 'Pagamento'],
  [/^\/pedido\//, 'Seu pedido'],
  [/^\/perfil\/carteiras/, 'Carteiras'],
  [/^\/perfil\/favoritos/, 'Lista de interesse'],
  [/^\/perfil/, 'Meu perfil'],
  [/^\/nft\//, ''],
]

/** Frames mobile do Figma: sem header global; páginas internas têm "voltar" + título. */
export function MobileTopBar() {
  const router = useRouter()
  const path = useRouterState({ select: (s) => s.location.pathname })
  if (path === '/' || path.startsWith('/nft/')) return null
  const title = TITLES.find(([re]) => re.test(path))?.[1] ?? ''
  return (
    <div className="sticky top-0 z-40 flex h-14 items-center gap-3 bg-background/95 px-4 backdrop-blur md:hidden">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.history.back() : router.navigate({ to: '/' }))}
        className="grid size-9 place-items-center rounded-full border border-border text-foreground hover:border-primary"
        aria-label="Voltar"
      >
        <ChevronLeftIcon className="size-5" aria-hidden />
      </button>
      {title && <p className="flex-1 pr-12 text-center text-lg font-bold">{title}</p>}
    </div>
  )
}
