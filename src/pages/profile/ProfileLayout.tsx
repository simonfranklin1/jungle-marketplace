import { Link, Outlet } from '@tanstack/react-router'
import { AlertTriangleIcon, DownloadIcon, HeartIcon, LineChartIcon, LogOutIcon, MapPinIcon, ShoppingCartIcon, UserIcon } from 'lucide-react'
import { logout } from '@/features/auth/auth-actions'
import { authDialog, useUser } from '@/features/auth/session-store'
import { comingSoon } from '@/lib/coming-soon'

const item =
  'relative flex items-center gap-3 whitespace-nowrap px-4 py-3 text-sm text-primary hover:bg-secondary data-[status=active]:bg-secondary data-[status=active]:before:absolute data-[status=active]:before:inset-y-0 data-[status=active]:before:left-0 data-[status=active]:before:w-1 data-[status=active]:before:bg-primary'

export function ProfileLayout() {
  const user = useUser()
  if (!user)
    return (
      <div className="container-k py-20 text-center">
        <h1 className="text-xl font-bold">Entre para acessar seu perfil</h1>
        <button type="button" onClick={() => authDialog.open('login')} className="mt-6 rounded-sm bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
          Entrar
        </button>
      </div>
    )
  return (
    <div className="container-k pt-6">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="min-w-0 bg-card md:self-start">
          <h1 className="px-4 pt-4 pb-2 text-lg font-bold">Meu perfil</h1>
          <nav aria-label="Seções do perfil" className="flex overflow-x-auto md:flex-col">
            <Link to="/perfil" activeOptions={{ exact: true }} className={item}>
              <UserIcon className="size-4" aria-hidden /> Dados do perfil
            </Link>
            <Link to="/perfil/carteiras" className={item}>
              <MapPinIcon className="size-4" aria-hidden /> Carteiras
            </Link>
            <Link to="/perfil/favoritos" className={item}>
              <HeartIcon className="size-4" aria-hidden /> Lista de interesse
            </Link>
            <button type="button" aria-disabled="true" onClick={() => comingSoon('Atividade')} className={item}>
              <ShoppingCartIcon className="size-4" aria-hidden /> Atividade
            </button>
            <button type="button" aria-disabled="true" onClick={() => comingSoon('Ofertas')} className={item}>
              <LineChartIcon className="size-4" aria-hidden /> Ofertas
            </button>
            <button type="button" aria-disabled="true" onClick={() => comingSoon('Arquivos baixados')} className={item}>
              <DownloadIcon className="size-4" aria-hidden /> Arquivos baixados
            </button>
            <button type="button" aria-disabled="true" onClick={() => comingSoon('Suporte')} className={item}>
              <AlertTriangleIcon className="size-4" aria-hidden /> Suporte
            </button>
            <button type="button" onClick={() => void logout()} className={`${item} font-semibold md:border-t md:border-primary/60`}>
              <LogOutIcon className="size-4" aria-hidden /> Sair
            </button>
          </nav>
        </aside>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
