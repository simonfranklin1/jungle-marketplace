import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
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
