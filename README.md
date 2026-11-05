# Kurio — Marketplace de NFTs

Solução do [desafio de frontend da Jungle Gaming](https://github.com/junglegaming/frontend-challenge): um marketplace de NFTs com descoberta, compra e conta de colecionador, fiel ao Figma, em desktop e mobile.

O backend é **100% simulado com MSW** (REST + Socket.IO), inclusive no deploy público — não há servidor real nem blockchain.

- **Aplicação publicada:** _adicione aqui a URL da Vercel_
- **Repositório:** https://github.com/simonfranklin1/jungle-marketplace
- **Arquitetura e decisões:** [ARCHITECTURE.md](ARCHITECTURE.md)

## Stack

React 19 · TypeScript · Vite · TanStack Router · TanStack Query · Axios · Socket.IO (cliente real) · Tailwind CSS 4 · shadcn/ui (Base UI) · MSW 2 + `@mswjs/socket.io-binding` · Playwright · Lighthouse CI.

## Como rodar

Pré-requisito: **Node 20+** (testado com Node 22).

```bash
npm install
npm run dev            # http://localhost:5173 — app com mocks
```

Não há serviço externo: o MSW sobe junto com o app (Service Worker em `public/mockServiceWorker.js`).

### Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Desenvolvimento com mocks (MSW) |
| `npm run build` | Typecheck + build de produção (`dist/`) |
| `npm run preview` | Serve o build de produção em http://localhost:4173 (com mocks) |
| `npm run typecheck` | Checagem de tipos do app e dos testes |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright (sobe build + preview sozinho) |
| `npm run test:e2e:update` | Regera as baselines de regressão visual |
| `npm run test:e2e:report` | Abre o relatório HTML do último run |
| `npm run lighthouse` | Build + Lighthouse (mobile e desktop, 3 execuções) + `lighthouse/RESULTS.md` |

> Primeira vez com Playwright? Baixe o navegador uma vez: `npx playwright install chromium`.
> Para o Lighthouse, um Chrome/Chromium é necessário; se não houver Chrome instalado, aponte `CHROME_PATH` para o Chromium do Playwright.

### Variáveis de ambiente (todas opcionais)

| Variável | Padrão | Uso |
|---|---|---|
| `VITE_ENABLE_MOCKS` | `true` | `false` desliga o MSW (para apontar a uma API real) |
| `VITE_API_URL` | `/api` | Base da API REST |
| `VITE_REALTIME_URL` | `wss://realtime.kurio.test` | Servidor Socket.IO (interceptado pelo MSW) |

Nenhuma variável é necessária para rodar, testar ou fazer deploy.

## Credenciais fictícias

| Conta | E-mail | Senha | Observação |
|---|---|---|---|
| Demo | `demo@kurio.test` | `Kurio@123` | Já tem carteira MetaMask cadastrada (checkout direto) |
| Ana | `ana@kurio.test` | `Kurio@123` | Começa sem carteiras (testa o cadastro) |

Senhas nunca ficam em texto puro: o mock guarda apenas SHA-256 com salt. Também é possível criar contas novas.

**Cupons:** `KURIO10` (10%), `GENESIS20` (20%, subtotal mínimo 2 ETH), `EXPIRADO` (expirado).

## Cenários do mock e reset

Os cenários são determinísticos e ficam salvos até serem trocados:

- **Pela URL:** `?scenario=<nome>` em qualquer página — ex.: `/checkout?scenario=payment-rejected`
- **Pelo painel de QA:** abra com `?qa=1` (botão **QA** no canto inferior). Ele aciona o backend simulado — eventos chegam pelo Socket.IO como em produção. `?qa=0` esconde o painel.
- **Reset completo:** `?reset=1` restaura banco do mock, sessão e carrinho de visitante. Volte ao padrão com `?scenario=default`.

| Cenário | Efeito |
|---|---|
| `default` | Latência curta, tudo funciona |
| `slow` | 2,5 s em todas as requisições (skeletons) |
| `variable-latency` | Latência variável determinística (respostas fora de ordem) |
| `offline` | Toda requisição falha com erro de rede |
| `empty-catalog` | Catálogo sem resultados |
| `catalog-error` | 503 na listagem de NFTs |
| `flaky` | A primeira tentativa de cada GET falha (retry automático) |
| `timeout` | Catálogo excede o timeout |
| `session-expired` | Sessão expira 30 s após o login |
| `favorites-error` | Falha ao salvar favorito (rollback otimista) |
| `coupon-error` | Serviço de cupons indisponível |
| `price-change` | Preço muda no momento de confirmar o pedido |
| `stock-conflict` | Edição esgota ao confirmar o pedido |
| `order-timeout` | Pedido é criado, mas a resposta expira (recuperação por idempotência) |
| `payment-rejected` | Pagamento recusado após o processamento |
| `wallet-rejected` | Usuário recusa a conexão da carteira |
| `wallet-disconnect` | Carteira desconecta durante a confirmação |

### Como reproduzir os fluxos de falha

1. **Pagamento recusado:** entre como `demo`, adicione um NFT, vá ao pagamento com `?scenario=payment-rejected`, conecte a MetaMask e confirme → "Pagamento recusado"; os itens continuam no carrinho.
2. **Timeout sem duplicar pedido:** mesmo fluxo com `?scenario=order-timeout` → "Resposta demorou; verificando o pedido com a mesma chave…" → um único pedido é criado.
3. **Preço muda na confirmação:** `?scenario=price-change` → aviso "O total mudou de X para Y"; nada é comprado até nova confirmação.
4. **Mudança em tempo real no carrinho:** `/carrinho?qa=1` → QA → **Preço +0.10** ou **Esgotar edição** → resumo atualiza, aviso acessível e finalização bloqueada.
5. **Eventos duplicados/antigos e queda de conexão:** em `/nft/<id>?qa=1` use **Evento duplicado**, **Evento velho** (não muda nada) e **Derrubar socket** (rodapé mostra "Reconectando…" e o app reconcilia via REST).
6. **Sessão expirada:** `?scenario=session-expired`, faça login e espere 30 s (ou QA → **Expirar sessão**) → modal de login no mesmo lugar, sem perder o contexto.

## Testes (Playwright)

53 testes cobrindo as **12 áreas exigidas** + regressão visual, em Chromium desktop (1440×900) e mobile (390×844):

| Arquivo | Área |
|---|---|
| `e2e/01-catalog.spec.ts` | Busca, filtros combinados, ordenação, paginação, histórico |
| `e2e/02-detail.spec.ts` | Acesso direto, inexistente, edição esgotada, limite |
| `e2e/03-auth.spec.ts` | Cadastro, login, expiração (relógio controlado), logout, troca de usuário |
| `e2e/04-favorites.spec.ts` | Favoritos, falha de mutação e rollback |
| `e2e/05-cart.spec.ts` | Quantidades, remoção, cupom, persistência após refresh/login |
| `e2e/06-purchase.spec.ts` | Compra completa até o recibo confirmado |
| `e2e/07-payment-failures.spec.ts` | Recusa, clique repetido, timeout com o mesmo pedido, conflito de idempotência |
| `e2e/08-profile.spec.ts` | Perfil, avatar, senha e carteiras com erros de validação |
| `e2e/09-realtime-checkout.spec.ts` | Preço/estoque via Socket.IO durante o checkout |
| `e2e/10-realtime-events.spec.ts` | Eventos duplicados/antigos, desconexão, pedido pendente retomado |
| `e2e/11-a11y.spec.ts` | Teclado, foco em diálogo, validação acessível |
| `e2e/12-loading.spec.ts` | Skeletons, falha e recuperação após retry |
| `e2e/visual.spec.ts` | Home, Detalhe, Carrinho e Pagamento (baselines em `e2e/__screenshots__`) |

Cada teste roda num contexto isolado (Service Worker, `localStorage` e banco do mock zerados). O ticker do "mercado ao vivo" é desligado nos testes; eventos são disparados pelo backend simulado e chegam ao app pelo `socket.io-client`. Relatório HTML em `playwright-report/`, traces e vídeos de falhas em `test-results/`.

## Performance (Lighthouse)

Configuração versionada em `lighthouse/` (mobile e desktop, Home e Detalhe, 3 execuções, mediana). Resultados e análise em [`lighthouse/RESULTS.md`](lighthouse/RESULTS.md); relatórios HTML/JSON em `lighthouse/reports/`.

## Estrutura

```
src/
  api/          contratos tipados (types.ts), cliente Axios, query options, chaves de cache
  features/     auth, cart, catalog, checkout, favorites, realtime (lógica + componentes)
  pages/        telas (Home, Detalhe, Carrinho, Pagamento, Pedido, Perfil, Carteiras)
  components/   layout (header, footer, navegação mobile) e ui (shadcn/Base UI)
  mocks/        "backend" MSW: handlers REST, Socket.IO, banco persistido, cenários
  lib/          utilitários (aritmética ETH em wei, cn)
e2e/            testes Playwright
lighthouse/     configuração e resultados do Lighthouse CI
```

## Uso de IA

Usei o **Claude Code** como par de programação para acelerar a implementação. Eu defini as prioridades e o plano em fases (base → catálogo → conta/carrinho → checkout → tempo real → perfil → testes/entrega), revisei e **testei manualmente cada fase** antes de seguir, e ajustei à mão a fidelidade visual com o Figma. As decisões de arquitetura estão documentadas em [ARCHITECTURE.md](ARCHITECTURE.md).
