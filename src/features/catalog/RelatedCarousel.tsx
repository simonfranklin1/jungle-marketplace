import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { nftRelatedQuery } from '@/api/nfts'
import { NftCard } from './NftCard'

export function RelatedCarousel({ nftId, title }: { nftId: string; title: string }) {
  const { data } = useQuery(nftRelatedQuery(nftId))
  const ref = useRef<HTMLUListElement>(null)
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' })
  return (
    <section aria-labelledby="related" className="mt-16">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h2 id="related" className="font-bold text-primary">
          {title}
        </h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => scroll(-1)} aria-label="Anteriores" className="grid size-8 place-items-center rounded-full border border-primary text-primary">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={() => scroll(1)} aria-label="Próximos" className="grid size-8 place-items-center rounded-full border border-primary text-primary">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <ul ref={ref} className="mt-6 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [scrollbar-width:none]">
        {(Array.isArray(data) ? data : Array.from({ length: 5 }, () => null)).map((n, i) => (
          <li key={n?.id ?? i} className="w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-[18.4%]">
            {n ? <NftCard nft={n} /> : <div className="shimmer aspect-[1/1.1]" aria-hidden />}
          </li>
        ))}
      </ul>
    </section>
  )
}

