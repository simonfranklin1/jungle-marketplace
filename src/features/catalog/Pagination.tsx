import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

function pages(current: number, total: number): Array<number | '…'> {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  const set = new Set([1, total, current, current - 1, current + 1].filter((p) => p >= 1 && p <= total))
  const sorted = [...set].sort((a, b) => a - b)
  const out: Array<number | '…'> = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…')
    out.push(p)
  })
  return out
}

const btn =
  'grid size-8 place-items-center rounded-sm border border-border text-sm hover:border-primary disabled:pointer-events-none disabled:opacity-40'

export function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Paginação" className="flex justify-end">
      <ul className="flex items-center gap-2">
        <li>
          <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
        </li>
        {pages(page, totalPages).map((p, i) =>
          p === '…' ? (
            <li key={`e${i}`} aria-hidden className="px-1 text-subtle">
              …
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                className={cn(btn, p === page && 'border-primary bg-primary font-bold text-primary-foreground')}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Página ${p}`}
                onClick={() => onPage(p)}
              >
                {p}
              </button>
            </li>
          ),
        )}
        <li>
          <button
            type="button"
            className={btn}
            disabled={page >= totalPages}
            onClick={() => onPage(page + 1)}
            aria-label="Próxima página"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </li>
      </ul>
    </nav>
  )
}
