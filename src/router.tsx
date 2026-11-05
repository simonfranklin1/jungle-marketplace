/* eslint-disable react-refresh/only-export-components -- arquivo de definição de rotas */
import {
  createRootRouteWithContext,
  redirect,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Link,
  Outlet,
  useNavigate,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { MobileNav } from '@/components/layout/MobileNav'
import { MobileTopBar } from '@/components/layout/MobileTopBar'
import { Toaster } from '@/components/ui/sonner'
import { LazyAuthDialog } from '@/features/auth/LazyAuthDialog'
import { authDialog, sessionStore } from '@/features/auth/session-store'
import { LiveAnnouncer } from '@/features/realtime/LiveAnnouncer'
import { QaPanel } from '@/features/realtime/QaPanel'
import { validateCatalogSearch, type CatalogSearch } from '@/features/catalog/search-schema'
import { CatalogSection } from '@/features/catalog/CatalogSection'
import { nftDetailQuery, nftListQuery, nftRelatedQuery } from '@/api/nfts'
import { toListQuery } from '@/features/catalog/search-schema'
import { HomePage } from '@/pages/HomePage'
import { NftDetailPage } from '@/pages/NftDetailPage'

interface RouterContext {
  queryClient: QueryClient
}

function RootLayout() {
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <Header />
      <MobileTopBar />
      <main id="conteudo" tabIndex={-1} className="min-h-screen outline-none">
        <Outlet />
      </main>
      <Footer />
      <MobileNav />
      <LazyAuthDialog />
      <LiveAnnouncer />
      <QaPanel />
      <Toaster position="top-center" richColors closeButton expand visibleToasts={4} />
    </>
  )
}

/**
 * Proteção de fluxos privados no Router: sem sessão, volta para uma rota pública, abre o
 * login e, após autenticar, retorna exatamente para onde o usuário queria ir.
 */
let appRouter: ReturnType<typeof createAppRouter> | null = null
function requireAuth(fallback: '/' | '/carrinho', reason: string) {
  return ({ location, preload }: { location: { href: string }; preload: boolean }) => {
    if (sessionStore.get()) return
    // pré-carregamento por intenção (hover/foco/toque no link) não é navegação: não abre o login.
    // Sem isso, ao fechar o modal o foco volta ao link protegido, o preload roda e o modal reabre.
    if (preload) throw redirect({ to: fallback })
    const target = location.href
    authDialog.open('login', reason, () => void appRouter?.history.push(target))
    throw redirect({ to: fallback })
  }
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

/** Navegação padrão do catálogo: qualquer mudança de filtro volta para a página 1. */
function useCatalogNavigate(from: '/' | '/mercado') {
  const navigate = useNavigate({ from })
  return (patch: Partial<CatalogSearch>, opts?: { keepPage?: boolean }) =>
    navigate({
      search: (prev: CatalogSearch) => {
        const next = { ...prev, ...patch }
        if (!opts?.keepPage) next.page = undefined
        return next
      },
      resetScroll: false,
    })
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: validateCatalogSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(nftListQuery(toListQuery(deps)))
  },
  component: function Index() {
    const search = indexRoute.useSearch()
    const onChange = useCatalogNavigate('/')
    return <HomePage search={search} onChange={onChange} />
  },
})

const marketRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mercado',
  validateSearch: validateCatalogSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(nftListQuery(toListQuery(deps)))
  },
  component: function Market() {
    const search = marketRoute.useSearch()
    const onChange = useCatalogNavigate('/mercado')
    return (
      <div className="pt-6">
        <div className="container-k mb-4">
          <nav aria-label="Trilha de navegação" className="text-sm font-semibold">
            <Link to="/" className="hover:text-primary">
              Início
            </Link>{' '}
            / <span aria-current="page">Mercado</span>
          </nav>
          <h1 className="mt-2 text-2xl font-bold">Mercado</h1>
        </div>
        <CatalogSection search={search} onChange={onChange} showFeatured={false} />
      </div>
    )
  },
})

const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$nftId',
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftDetailQuery(params.nftId))
    void context.queryClient.prefetchQuery(nftRelatedQuery(params.nftId))
  },
  component: function Nft() {
    const { nftId } = nftRoute.useParams()
    return <NftDetailPage nftId={nftId} />
  },
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/carrinho',
  component: lazyRouteComponent(() => import('@/pages/CartPage'), 'CartPage'),
})

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/checkout',
  beforeLoad: requireAuth('/carrinho', 'Entre para conectar sua carteira e finalizar a compra.'),
  component: lazyRouteComponent(() => import('@/pages/CheckoutPage'), 'CheckoutPage'),
})

const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pedido/$orderId',
  beforeLoad: requireAuth('/', 'Entre para ver seu pedido.'),
  component: lazyRouteComponent(() => import('@/pages/OrderPage'), 'OrderRoutePage'),
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/perfil',
  beforeLoad: requireAuth('/', 'Entre para acessar seu perfil.'),
  component: lazyRouteComponent(() => import('@/pages/profile/ProfileLayout'), 'ProfileLayout'),
})

const profileIndexRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: '/',
  component: lazyRouteComponent(() => import('@/pages/profile/ProfilePage'), 'ProfilePage'),
})

const walletsRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: '/carteiras',
  component: lazyRouteComponent(() => import('@/pages/profile/WalletsPage'), 'WalletsPage'),
})

const favoritesRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: '/favoritos',
  component: lazyRouteComponent(() => import('@/pages/profile/FavoritesPage'), 'FavoritesPage'),
})

function NotFound() {
  return (
    <div className="container-k py-20 text-center">
      <p className="text-5xl font-bold text-primary">404</p>
      <h1 className="mt-4 text-xl font-bold">Página não encontrada</h1>
      <Link to="/" className="mt-6 inline-block rounded-sm bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
        Voltar ao início
      </Link>
    </div>
  )
}

const routeTree = rootRoute.addChildren([indexRoute, marketRoute, nftRoute, cartRoute, checkoutRoute, orderRoute, profileRoute.addChildren([profileIndexRoute, walletsRoute, favoritesRoute])])

export function createAppRouter(queryClient: QueryClient) {
  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })
  appRouter = router
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
