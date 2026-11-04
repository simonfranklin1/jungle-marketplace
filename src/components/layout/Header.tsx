import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { LogIn, SearchIcon, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useCartCount } from '@/features/cart/cart-count'
import { cn } from '@/lib/utils'
import { comingSoon } from '@/lib/coming-soon'

const navLink =
  'relative py-2 text-sm text-foreground transition-colors hover:text-primary data-[status=active]:font-semibold data-[status=active]:text-primary data-[status=active]:after:absolute data-[status=active]:after:inset-x-0 data-[status=active]:after:-bottom-[13px] data-[status=active]:after:h-0.5 data-[status=active]:after:bg-primary'

export function Header() {
  const [searchOpen, setSearchOpen] = useState(false)
  const count = useCartCount()

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="container-k">
        <div className="flex h-16 items-center justify-between gap-4 border-b border-border">
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
              <ShoppingCart className="size-5" aria-hidden />
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
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  )
}

function AccountButton() {
  return (
    <Button
      size="sm"
      className="hidden h-8 gap-1.5 px-3 font-semibold sm:inline-flex"
      onClick={() => toast.info('Login chega na próxima fase.')}
    >
      <LogIn aria-hidden /> Entrar
    </Button>
  )
}

function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-24 translate-y-0 sm:max-w-lg">
        <DialogTitle>Buscar NFTs</DialogTitle>
        <DialogDescription className="text-muted-foreground">Nome, token ou coleção.</DialogDescription>
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const q = value.trim()
            onOpenChange(false)
            navigate({ to: '/mercado', search: q ? { q } : {} })
          }}
        >
          <label htmlFor="global-search" className="sr-only">
            Termo de busca
          </label>
          <Input
            id="global-search"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ex.: Emerald Ape"
            className={cn('h-10')}
          />
          <Button type="submit" className="h-10 px-4">
            Buscar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
