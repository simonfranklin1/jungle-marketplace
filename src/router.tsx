/* eslint-disable react-refresh/only-export-components -- arquivo de definição de rotas */
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Link,
  Outlet,
  useNavigate,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { MobileNav } from '@/components/layout/MobileNav'
import { Toaster } from '@/components/ui/sonner'
import { catalogSearchSchema, type CatalogSearch } from '@/features/catalog/search-schema'
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
      <main id="conteudo" tabIndex={-1} className="min-h-[60vh] outline-none">
        <Outlet />
      </main>
      <Footer />
      <MobileNav />
      <Toaster position="top-center" richColors closeButton />
    </>
  )
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
  validateSearch: catalogSearchSchema,
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
  validateSearch: catalogSearchSchema,
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

function Placeholder({ title }: { title: string }) {
  return (
    <div className="container-k py-20 text-center">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Em construção — chega nas próximas fases.</p>
    </div>
  )
}

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/carrinho',
  component: () => <Placeholder title="Carrinho" />,
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/perfil',
  component: () => <Placeholder title="Perfil" />,
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

const routeTree = rootRoute.addChildren([indexRoute, marketRoute, nftRoute, cartRoute, profileRoute])

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
