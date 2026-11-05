import { useState } from 'react'
import { CATEGORIES, NETWORKS, type NftListResponse } from '@/api/types'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import type { CatalogSearch } from './search-schema'

interface Props {
  search: CatalogSearch
  facets?: NftListResponse['facets']
  onChange: (patch: Partial<CatalogSearch>) => void
}

const itemCls =
  'flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-secondary hover:text-foreground aria-pressed:font-semibold aria-pressed:text-primary'

export function FilterPanel({ search, facets, onChange }: Props) {
  const min = Number(facets?.priceRange.min ?? '0.02')
  const max = Number(facets?.priceRange.max ?? '12.30')
  const current: [number, number] = [
    search.priceMin ?? min,
    search.priceMax ?? max,
  ]
  const [range, setRange] = useState<[number, number]>(current)
  // sincroniza o slider quando a URL muda (voltar/avançar, limpar filtros)
  const key = `${search.priceMin}-${search.priceMax}-${min}-${max}`
  const [syncedKey, setSyncedKey] = useState(key)
  if (syncedKey !== key) {
    setSyncedKey(key)
    setRange(current)
  }

  const fmt = (n: number) => n.toFixed(2).replace('.', ',')

  return (
    <div className="space-y-6">
      <section aria-labelledby="f-colecoes">
        <h2 id="f-colecoes" className="mb-2 font-semibold">
          Coleções
        </h2>
        <ul>
          {CATEGORIES.map((c) => {
            const active = search.category === c.id
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  className={itemCls}
                  onClick={() => onChange({ category: active ? undefined : c.id })}
                >
                  <span>{c.label}</span>
                  <span className="tabular-nums">({facets?.categories[c.id] ?? '–'})</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="f-preco">
        <h2 id="f-preco" className="mb-3 font-semibold">
          Faixa de preço
        </h2>
        <Slider
          min={min}
          max={max}
          step={0.01}
          value={range}
          onValueChange={(v) => setRange(v as [number, number])}
          aria-label="Faixa de preço em ETH"
          thumbLabels={['Preço mínimo em ETH', 'Preço máximo em ETH']}
          className="px-1 [&_[data-slot=slider-range]]:bg-primary [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:border-[3px] [&_[data-slot=slider-thumb]]:border-card [&_[data-slot=slider-thumb]]:bg-primary [&_[data-slot=slider-thumb]]:shadow-[0_0_0_1px_var(--card)] [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-track]]:bg-primary"
        />
        <p className="mt-3 text-sm" aria-live="polite">
          Preço: {fmt(range[0])} – {fmt(range[1])} ETH
        </p>
        <button
          type="button"
          className="mt-2 rounded-sm bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground hover:bg-primary/85"
          onClick={() =>
            onChange({
              priceMin: range[0] > min ? Number(range[0].toFixed(2)) : undefined,
              priceMax: range[1] < max ? Number(range[1].toFixed(2)) : undefined,
            })
          }
        >
          Aplicar
        </button>
      </section>

      <section aria-labelledby="f-rede">
        <h2 id="f-rede" className="mb-2 font-semibold">
          Rede
        </h2>
        <ul>
          {NETWORKS.map((n) => {
            const active = search.network === n.id
            return (
              <li key={n.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  className={cn(itemCls)}
                  onClick={() => onChange({ network: active ? undefined : n.id })}
                >
                  <span>{n.label}</span>
                  <span className="tabular-nums">({facets?.networks[n.id] ?? '–'})</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
