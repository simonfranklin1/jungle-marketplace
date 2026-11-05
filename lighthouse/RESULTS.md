# Resultados do Lighthouse (mediana de 3 execuções)

Lighthouse 12.6.1 · build de produção (`vite preview`) · cenário padrão do mock · 2026-11-05T11:12:31.893Z

| Perfil | Página | Execuções | Performance | Acessibilidade | Boas práticas | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|---|
| mobile | `/` | 3 | 65 | 98 | 100 | 92 | 4.57 s | 0.000 | 480 ms |
| mobile | `/nft/emerald-ape-042` | 3 | 59 | 100 | 100 | 92 | 4.51 s | 0.000 | 659 ms |
| desktop | `/` | 3 | 86 | 100 | 100 | 92 | 1.24 s | 0.002 | 199 ms |
| desktop | `/nft/emerald-ape-042` | 3 | 97 | 100 | 100 | 92 | 1.11 s | 0.000 | 40 ms |

Ambiente: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36

Relatórios HTML e JSON de cada execução: `lighthouse/reports/<perfil>/`.

## Análise

**Condições:** build de produção servido por `vite preview` local, cenário padrão do mock, Lighthouse CI com 3 execuções por página e perfil (mediana). Mobile usa a emulação padrão do Lighthouse (Moto G Power, 4G lento, CPU 4x mais lenta); desktop usa o preset oficial `desktop`.

**Acessibilidade, Boas práticas e SEO** ficam dentro das metas (≥ 95 / ≥ 95 / ≥ 90) nos dois perfis.

**Performance no mobile fica abaixo de 90.** Causas identificadas no próprio relatório:

1. **O LCP é a imagem do primeiro card do catálogo/detalhe**, que só pode ser exibida depois que os dados chegam. Como o backend é simulado, os dados dependem do **MSW iniciar no navegador**: baixar e executar o bundle do MSW (~170 kB gzip: `msw`, `tough-cookie`, `tldts`, interceptores e o binding de Socket.IO) e registrar o Service Worker. A fase "render delay" do LCP concentra quase todo o tempo.
2. **TBT** vem principalmente da execução desse bundle do MSW e do React no primeiro render, multiplicada pelo CPU 4x mais lento do perfil mobile.

Em produção com uma API real (`VITE_ENABLE_MOCKS=false`) esse custo não existe: o MSW nem é baixado (import dinâmico), e o LCP passa a depender apenas da latência da API.

**O que foi feito para melhorar (sem simplificar imagens, fontes ou funcionalidades):**

- Bundle inicial de **782 kB → 336 kB** (243 → 108 kB gzip): rotas privadas (carrinho, pagamento, pedido, perfil, carteiras) e diálogos (login, busca, filtros) carregados sob demanda; validação de URL sem dependência (o `zod` saiu do bundle).
- MSW e `socket.io-client` carregados por import dinâmico, fora do bundle principal.
- Imagens em WebP com `width/height` explícitos (CLS = 0), `fetchpriority="high"` nas primeiras do catálogo e `preload` da arte principal; demais com `loading="lazy"`.
- Fontes locais (`@fontsource`), sem requisições externas.
- Testado renderizar o app **antes** do MSW ficar pronto: piorou (TBT ~1,9 s) porque React e MSW passam a disputar a CPU e o LCP continua dependendo dos dados — a mudança foi revertida.

**Próximos passos possíveis:** pré-renderizar (SSG) o shell da Home/Detalhe, ou servir o primeiro lote do catálogo junto do HTML quando houver backend real; nenhum deles é aplicável a um backend que existe apenas no navegador sem simular dados fora da camada de rede, o que o desafio proíbe.
