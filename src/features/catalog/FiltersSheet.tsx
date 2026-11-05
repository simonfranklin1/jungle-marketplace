import type { NftListResponse } from '@/api/types'
import { SORTS } from '@/api/types'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { FilterPanel } from './FilterPanel'
import type { CatalogSearch } from './search-schema'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  search: CatalogSearch
  facets?: NftListResponse['facets']
  onChange: (patch: Partial<CatalogSearch>, opts?: { keepPage?: boolean }) => void
}

export function FiltersSheet({ open, onOpenChange, search, facets, onChange }: Props) {
  return (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto bg-card p-4">
      <SheetHeader className="p-0">
        <SheetTitle>Filtros</SheetTitle>
        <SheetDescription>Os filtros são aplicados imediatamente.</SheetDescription>
      </SheetHeader>
      <label className="grid gap-1.5 text-sm">
        <span className="font-semibold">Ordenar por</span>
        <select
          value={search.sort ?? 'recent'}
          onChange={(e) => onChange({ sort: e.target.value === 'recent' ? undefined : (e.target.value as CatalogSearch['sort']) })}
          className="rounded-sm border border-input bg-background px-2 py-2 text-sm"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <FilterPanel search={search} facets={facets} onChange={onChange} />
    </SheetContent>
  </Sheet>  )
}
