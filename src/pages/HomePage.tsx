import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { CatalogSection } from '@/features/catalog/CatalogSection'
import type { CatalogSearch } from '@/features/catalog/search-schema'
import { comingSoon } from '@/lib/coming-soon'
import { cn } from '@/lib/utils'

interface Props {
  search: CatalogSearch
  onChange: (patch: Partial<CatalogSearch>, opts?: { keepPage?: boolean }) => void
}

const SLIDES = [
  { img: '/nfts/emerald.webp', title: ['SEJA DONO DO FUTURO', 'DA ARTE DIGITAL'] },
  { img: '/nfts/ivory.webp', title: ['COLECIONE OBRAS', 'VERIFICADAS NA REDE'] },
  { img: '/nfts/golden.webp', title: ['APOIE ARTISTAS', 'EMERGENTES'] },
]

export function HomePage({ search, onChange }: Props) {
  return (
    <>
      <div className="hidden md:block">
        <Hero />
      </div>
      <div className="pt-5 md:mt-16 md:pt-0">
        <CatalogSection search={search} onChange={onChange} mobileHero={<MobileHero />} />
      </div>
      <PromoCards onExplore={() => onChange({ tab: 'new' })} onExploreAll={() => onChange({ tab: undefined })} />
      <Journal />
    </>
  )
}

function Hero() {
  const [i, setI] = useState(0)
  const slide = SLIDES[i]
  return (
    <section aria-roledescription="carrossel" aria-label="Destaques Kurio" className="container-k pt-6 md:pt-8">
      <div className="relative grid grid-cols-[minmax(0,1fr)_112px] items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#5a3a22] to-[#2a1a12] p-5 sm:grid-cols-[minmax(0,1fr)_200px] md:grid-cols-[1fr_300px] md:gap-6 md:rounded-none md:bg-none md:p-0 lg:grid-cols-[1fr_400px]">
        <div className="md:pl-8">
          <p className="text-xs md:text-sm">Bem-vindo à Kurio</p>
          <h1 className="mt-2 text-lg leading-snug font-bold tracking-wider sm:text-2xl md:mt-3 md:text-4xl md:leading-[1.6]">
            {slide.title[0]}
            <br />
            {slide.title[1]}
          </h1>
          <p className="mt-2 max-w-md text-xs leading-5 text-muted-foreground md:mt-3 md:text-sm md:leading-6">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e
            tenha uma parte da cultura da internet.
          </p>
          <a
            href="#catalogo"
            className="mt-3 inline-flex items-center gap-2 md:mt-6 rounded-sm text-sm font-bold text-primary md:bg-primary md:px-6 md:py-2 md:text-primary-foreground md:hover:bg-primary/85"
          >
            EXPLORAR <ArrowRight className="size-4 md:hidden" aria-hidden />
          </a>
          <div className="mt-4 -ml-[7px] flex md:mt-8 md:ml-0 md:justify-center" role="group" aria-label="Escolher destaque">
            {SLIDES.map((s, idx) => (
              // área de toque de 24px (WCAG 2.5.8); o ponto visível continua com 10px
              <button
                key={s.img}
                type="button"
                onClick={() => setI(idx)}
                aria-label={`Destaque ${idx + 1} de ${SLIDES.length}`}
                aria-current={idx === i}
                className="grid size-6 place-items-center rounded-full"
              >
                <span aria-hidden className={cn('size-2.5 rounded-full bg-primary/50', idx === i && 'bg-primary')} />
              </button>
            ))}
          </div>
        </div>
        <img
          src={slide.img}
          alt="Arte em destaque da coleção Kurio Apes"
          width={400}
          height={400}
          fetchPriority="high"
          className="mx-auto aspect-square w-full max-w-[400px] self-start rounded-2xl object-cover md:self-center"
        />
      </div>
    </section>
  )
}

function PromoCards({ onExplore, onExploreAll }: { onExplore: () => void; onExploreAll: () => void }) {
  const cards = [
    {
      img: '/nfts/emerald.webp',
      title: 'Lançamentos gênesis de edição limitada',
      text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
      onClick: onExplore,
    },
    {
      img: '/nfts/ivory.webp',
      title: 'Arte digital selecionada e muito mais',
      text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
      onClick: onExploreAll,
    },
  ]
  return (
    <section aria-label="Coleções em destaque" className="container-k mt-20 grid gap-6 md:grid-cols-2">
      {cards.map((c) => (
        <article key={c.title} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-3 bg-card">
          <img src={c.img} alt="" width={240} height={240} loading="lazy" className="aspect-square w-full object-cover" />
          <div className="p-3 text-right">
            <h2 className="text-sm font-bold">{c.title}</h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{c.text}</p>
            <a
              href="#catalogo"
              onClick={c.onClick}
              className="mt-3 inline-block rounded-sm bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/85"
            >
              Explorar →
            </a>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  { img: '/nfts/ivory.webp', date: '12 de setembro', read: 6, title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.' },
  { img: '/nfts/emerald.webp', date: '13 de setembro', read: 2, title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.' },
  { img: '/nfts/sage.webp', date: '15 de setembro', read: 3, title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.' },
  { img: '/nfts/golden.webp', date: '15 de setembro', read: 2, title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.' },
]

function Journal() {
  return (
    <section aria-labelledby="diario" className="container-k mt-20">
      <h2 id="diario" className="text-center text-xl font-bold">
        Diário da Cunhagem
      </h2>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
      </p>
      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((p) => (
          <li key={p.title} className="bg-card">
            <img src={p.img} alt="" width={300} height={200} loading="lazy" className="aspect-[3/2] w-full object-cover" />
            <div className="p-3">
              <p className="text-[11px] text-muted-foreground">
                {p.date} | Leitura de {p.read} min
              </p>
              <h3 className="mt-2 text-sm font-bold">{p.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{p.text}</p>
              <button
                type="button"
                aria-disabled="true"
                onClick={() => comingSoon('O Diário da Cunhagem')}
                className="mt-2 text-xs font-semibold text-primary hover:underline"
              >
                Ler mais →<span className="sr-only"> sobre {p.title}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Hero do frame mobile (366x190): retângulo com gradiente e duas elipses ao fundo,
 * texto à esquerda e duas artes sobrepostas à direita.
 */
function MobileHero() {
  return (
    <section aria-label="Destaque Kurio" className="relative h-[190px] overflow-hidden rounded-[30px] bg-[#2a1a13]">
      <div aria-hidden className="absolute inset-0" style={{
        background: 'linear-gradient(104.74deg, rgba(210, 138, 76, 0.2) 1.08%, rgba(210, 138, 76, 0.1) 99.23%)'
      }} />
      <div
        aria-hidden
        className="absolute -top-[31px] -left-[80px] size-[248px] rounded-full"
        style={{ background: 'linear-gradient(160.25deg, rgba(221, 154, 95, 0.43) 22.1%, rgba(210, 138, 76, 0.04) 87.42%)' }}
      />
      <div
        aria-hidden
        className="absolute -top-[10px] left-[73px] size-[248px] rounded-full"
        style={{ background: 'linear-gradient(160.25deg, rgba(221, 154, 95, 0.37) 22.1%, rgba(210, 138, 76, 0) 87.42%)' }}
      />
      <div className="relative z-10 flex h-full flex-col justify-center pt-[5.5px] pb-[28px] pr-[46%] pl-4">
        <p className="text-[11px]">Bem-vindo à Kurio</p>
        <h1 className="mt-1.5 text-[17px] leading-snug font-bold tracking-wide">
          SEJA DONO DA
          <br />
          CULTURA DIGITAL
        </h1>
        <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">Descubra NFTs selecionados de criadores do mundo todo.</p>
        <a href="#catalogo" className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-primary">
          EXPLORAR <ArrowRight className="size-3.5" aria-hidden />
        </a>
      </div>
      <img
        src="/nfts/emerald.webp"
        alt="Arte em destaque: Emerald Ape #042"
        width={138}
        height={138}
        fetchPriority="high"
        className="absolute top-3 right-3 z-10 size-[138px] rounded-2xl object-cover"
      />
      <img
        src="/nfts/sage-thumb.webp"
        alt=""
        width={58}
        height={58}
        className="absolute top-[100px] right-[84px] z-20 size-[58px] rounded-xl object-cover"
      />
      <div className="absolute right-[50%] bottom-3 z-10 flex gap-1.5" aria-hidden>
        <span className="size-[7px] rounded-full bg-primary" />
        <span className="size-[7px] rounded-full bg-primary/70" />
        <span className="size-[7px] rounded-full bg-primary/70" />
      </div>
    </section>
  )
}
