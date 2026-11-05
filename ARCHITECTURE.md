# Arquitetura

## Visão geral

```
UI (pages/, features/*)  ──►  TanStack Query (cache)  ──►  Axios (api/client.ts)  ──►  /api/*  ──►  MSW (mocks/)
        ▲                                ▲                                                  │
        │                                └──── realtime-client.ts ◄── socket.io-client ◄────┘ (WebSocket interceptado)
TanStack Router (rotas, search params, guardas)
```

- **Contratos tipados** em `src/api/types.ts`, compartilhados por app e mock (mesmos tipos no transporte, no estado e na UI).
- **Toda chamada REST passa pelo Axios** (`src/api/client.ts`). Componentes e hooks não contêm respostas falsas nem caminhos alternativos: o único "backend" é o MSW, na camada de rede.
- **Valores em ETH** trafegam como strings decimais e são calculados em **wei (bigint)** em `src/lib/eth.ts`, usado pelo app e pelo mock — sem erro de ponto flutuante. Quantidades são inteiras. A cotação do servidor (`/quote`) é a referência para finalizar.

## Contratos REST

Base `/api`. Autenticação por `Authorization: Bearer <token>`. Erros sempre no formato:

```json
{ "error": { "code": "VALIDATION", "message": "…", "fields": { "email": "…" }, "details": {} } }
```

| Código | HTTP | Quando |
|---|---|---|
| `VALIDATION` | 422 | Campos inválidos (com `fields` por campo) |
| `UNAUTHORIZED` / `SESSION_EXPIRED` | 401 | Sem sessão / sessão vencida |
| `FORBIDDEN` | 403 | Recurso de outro usuário; carteira recusada |
| `NOT_FOUND` | 404 | NFT, pedido ou carteira inexistente |
| `CONFLICT` | 409 | E-mail/usuário/endereço já usado; carteira desconectada |
| `UNAVAILABLE` / `PRICE_CHANGED` | 409 | Estoque ou preço mudou na confirmação (com a nova cotação em `details.quote`) |
| `COUPON_INVALID` | 422 | Cupom inválido/expirado |
| `IDEMPOTENCY_CONFLICT` | 409 | Mesma chave com conteúdo diferente |
| `TRANSIENT` | 503 / rede | Falha temporária, offline ou timeout |

| Recurso | Endpoints |
|---|---|
| Sessão e conta | `POST /auth/signup`, `POST /auth/login`, `GET /auth/session`, `POST /auth/logout` |
| NFTs | `GET /nfts?q&category&network&priceMin&priceMax&tab&sort&page&pageSize` (com `facets`), `GET /nfts/:id`, `GET /nfts/:id/related` |
| Favoritos | `GET /favorites`, `PUT /favorites/:id`, `DELETE /favorites/:id` |
| Carrinho | `GET /cart`, `PUT /cart` (itens + cupom), `POST /cart/merge` (carrinho de visitante) |
| Cotação | `POST /quote` (itens, cupom, rede → linhas, subtotal, desconto, taxa, total, `issues`), `POST /coupons/validate` |
| Pedidos | `POST /orders` (**`Idempotency-Key` obrigatório**), `GET /orders`, `GET /orders/:id` |
| Carteira (simulação) | `POST /wallet/connect` (só conecta carteiras cadastradas; pode recusar) |
| Perfil | `GET /profile`, `PATCH /profile`, `PUT/DELETE /profile/avatar`, `POST /profile/password` |
| Carteiras | `GET /wallets`, `POST /wallets`, `PUT /wallets/:id` |
| Ferramentas de QA | `POST /__dev/realtime`, `POST /__dev/scenario`, `POST /__dev/expire-session` (usadas pelo painel `?qa=1` e pelo E2E) |

**Idempotência de pedidos:** o servidor guarda `chave → (usuário, hash do corpo, pedido)`. Mesma chave + mesmo corpo devolve o pedido já criado (200); mesma chave + corpo diferente devolve `IDEMPOTENCY_CONFLICT`. O cliente gera **uma chave por tentativa de compra** e a reaproveita em retries automáticos após timeout; ela só muda se o conteúdo do pedido mudar.

**Revalidação antes de confirmar:** o checkout pede uma cotação nova; se total, estoque ou cupom mudaram, mostra a diferença e exige nova confirmação. O servidor revalida tudo de novo em `POST /orders` (preço, estoque, cupom, taxa e `expectedTotalEth`).

**Ciclo do pedido:** `pending` → (`confirmed` | `rejected`), estados terminais. A liquidação acontece por timer e também de forma preguiçosa no `GET`, então sobrevive a refresh. Confirmado: baixa estoque e remove do carrinho **só os itens e quantidades comprados**. Rejeitado: o carrinho fica intacto. O recibo (`order.receipt`) é um **snapshot** da cotação; mudanças posteriores no catálogo não o alteram.

## Eventos em tempo real (Socket.IO)

O app usa o **`socket.io-client` real**. O MSW intercepta o WebSocket (`ws.link('wss://realtime.kurio.test')`) e o `@mswjs/socket.io-binding` implementa o protocolo Socket.IO (handshake Engine.IO + pacotes de evento). O mock envia `ping` a cada 20 s para manter a conexão viva.

Formato comum:

```ts
{ id: string; type: 'nft.updated' | 'order.updated'; resource: { type; id }; version: number; occurredAt: string; data }
```

| Evento | Destino | Efeito no app |
|---|---|---|
| `nft.updated` | todas as conexões (dado público) | Atualiza preço/estoque em catálogo, detalhe e relacionados; invalida cotações (carrinho/checkout recalculam); anuncia em `aria-live`; toast se o NFT está no carrinho |
| `order.updated` | **só a conexão autenticada como dono do pedido** | Atualiza o pedido em cache, mostra confirmação/recusa, sincroniza carrinho |

Após conectar, o cliente envia `auth` com o token (e reenvia no login/logout/troca de usuário); o servidor associa a conexão ao usuário.

**Garantias no cliente** (`src/features/realtime/realtime-client.ts`):
- **Duplicados:** ids já processados são ignorados (conjunto limitado a 500).
- **Antigos/fora de ordem:** cada recurso tem a maior versão conhecida (de REST ou eventos); eventos com versão menor ou igual são descartados — nunca regridem estado nem reaplicam efeitos.
- **Isolamento:** `order.updated` de outro usuário é descartado mesmo que chegue (defesa em profundidade além do filtro do servidor).
- **Reconexão:** após uma queda, o cliente **reconcilia com a REST** (invalida NFTs, cotações, pedidos e carrinho), recuperando eventos perdidos.
- **Pedido pendente:** além do evento, o pedido pendente é consultado a cada 5 s como reserva; após reload ou reconexão o estado é recuperado sem criar outra compra.

## Sessão

- Login/cadastro retornam `{ token, expiresAt, user }`. O token fica em `localStorage` (`kurio:session`) para **recuperar a sessão após refresh**; na inicialização ela é revalidada em `GET /auth/session`.
- Senhas só existem no mock como **SHA-256 + salt**; a mesma mensagem é usada para e-mail inexistente e senha errada.
- **Expiração:** 401 `SESSION_EXPIRED` (ou o prazo local vencido) limpa a sessão e o cache privado e **abre o modal de login no mesmo lugar** — o usuário retoma o contexto (formulário do checkout é preservado).
- **Rotas privadas** (`/checkout`, `/perfil/*`, `/pedido/:id`) são protegidas no **TanStack Router** (`beforeLoad`): sem sessão, redireciona, abre o login e, após autenticar, volta exatamente ao destino.
- **Logout/troca de usuário:** remove todo o cache privado, limpa o carrinho de visitante e reidentifica o socket.

## Carrinho

- **Visitante:** `localStorage` (`kurio:guest-cart`).
- **Logado:** servidor (`/cart`), com **atualização otimista e rollback** (`useMutation` + `setQueryData`), gravações serializadas (`scope`) para cliques rápidos chegarem em ordem.
- **Login:** o carrinho de visitante é **mesclado** ao da conta (`POST /cart/merge`, quantidades somadas e limitadas por pedido).
- **Valores:** sempre vindos da cotação do servidor (`useQuote`), que também reporta `issues` (item esgotado, preço mudou, NFT inexistente); a UI bloqueia a finalização enquanto houver problema.

## Estratégia de cache (TanStack Query)

| Dado | Chave | Política |
|---|---|---|
| Lista de NFTs | `['nfts','list', params]` | `staleTime` 30 s; `keepPreviousData` na paginação; a chave inclui todos os parâmetros, então respostas fora de ordem não se misturam e requisições antigas são canceladas via `AbortSignal` |
| Detalhe / relacionados | `['nfts','detail', id]` | 30–60 s; prefetch no `loader` da rota e no hover dos links |
| Cotação | `['quote', {items, coupon, network}]` | 10 s; invalidada por `nft.updated` |
| Dados privados | `['me', userId, …]` (carrinho, favoritos, pedidos, perfil, carteiras) | Isolados por usuário; removidos de uma vez no logout |

- **Retry:** só para erros transitórios (503, rede, timeout), até 2 vezes com backoff; 4xx não são repetidos. Mutações não têm retry automático — exceto a criação de pedido, que repete com a **mesma chave de idempotência**.
- **Invalidação após mutações e eventos:** carrinho e pedidos após compra; cotações após eventos de NFT; tudo que é ativo após reconexão do socket.
- **Otimista com rollback:** carrinho e favoritos.

## Mocking (MSW)

- Handlers em `src/mocks/handlers/*`, banco em `src/mocks/db.ts` persistido em `localStorage` (sobrevive a refresh), seed determinístico (45 NFTs, 2 usuários) em `src/mocks/data/`.
- Os mesmos handlers servem desenvolvimento, demo (deploy) e testes.
- Cenários em `src/mocks/scenario.ts`, aplicados por um handler de rede que roda antes dos demais (latência variável, offline) e por regras nos handlers específicos.
- Mudanças de dados aparecem **na REST e nos eventos correspondentes** (ex.: compra confirmada baixa o estoque e emite `nft.updated`).

**Limitações conhecidas do transporte simulado:**
- O MSW roda num Service Worker que o navegador pode encerrar quando ocioso; ao religar, ele "esquece" a aba e deixa requisições passarem ao servidor estático (que devolve HTML). O cliente detecta resposta não-JSON, reativa o registro da aba (`MOCK_ACTIVATE`) e repete a requisição uma vez.
- O `engine.io-client` captura a classe `WebSocket` no momento do import; por isso o `socket.io-client` é importado dinamicamente **depois** que o MSW passou a interceptar.
- O binding não implementa rooms/namespaces; o roteamento por usuário é feito no próprio mock.
- O estado do "servidor" é por navegador (cada aba/dispositivo tem seu banco). Dois usuários em abas do mesmo navegador compartilham o banco, como num servidor real.

## Decisões de UX

- Ações fora do escopo (Criadores, Aprenda, editoriais, login social, leitor de QR, newsletter, explorador de blocos) **não fingem funcionar**: mostram "não faz parte desta versão".
- Painel de QA opcional (`?qa=1`) para avaliadores dispararem cenários e eventos sem ferramentas externas.
- Mercado "ao vivo": a cada 30 s um NFT em destaque muda de preço ou estoque (desligado nos testes).
- Indicador de conexão no rodapé ("Preços ao vivo" / "Conectando…" / "Reconectando…"): mostra o estado do Socket.IO, para o usuário saber quando os preços deixaram de atualizar e quando voltaram (após reconectar, o app reconcilia com a REST). Não existe no Figma; é um acréscimo discreto de feedback. Também serve aos testes E2E (`data-testid="realtime-status"`).
- Feedback acessível: região `aria-live` global para mutações e eventos; toasts expandidos; erros de formulário com `aria-invalid` + `aria-describedby`; foco controlado em diálogos e gavetas; `prefers-reduced-motion` respeitado.
- Performance: rotas privadas e diálogos (login, busca, filtros) carregam sob demanda; validador da URL sem dependências.

## Desvios do Figma

- **Mobile sem header global:** como nos frames mobile; o login no mobile é aberto pelo ícone de Perfil da barra inferior (rota protegida). Páginas internas ganham uma barra com "voltar" e título.
- **Detalhe, carrinho e pagamento no mobile** seguem os frames: sem barra inferior nem rodapé; o detalhe tem barra de compra fixa (Qtd., preço, "Comprar NFT" e atalho do carrinho); o carrinho usa cards de item e painel de resumo. No **pagamento mobile** o frame mostra só a escolha de carteira: os dados do colecionador (pré-preenchidos pelo perfil) ficam recolhidos em "Dados do colecionador" e abrem automaticamente se a validação apontar erro.
- **Login e cadastro no mobile** aparecem em tela cheia (como os frames), usando o mesmo componente que no desktop é um modal — mantém o retorno ao fluxo anterior e o foco controlado.
- **Código de indicação** é opcional no pagamento e nas carteiras (no Figma aparece como obrigatório; não há regra de negócio que o exija).
- **"Ordenar por"** no mobile fica dentro da gaveta de filtros (o frame não mostra o controle).
- **"Ver no Etherscan"** avisa que a transação é simulada, em vez de abrir um link inexistente.
- **Artes dos NFTs:** recortadas dos frames do Figma (4 artes em WebP 640/160 px) e reaproveitadas em vários NFTs, como no próprio layout.
- **Estados não desenhados** (erro, vazio, carregamento, pendente/rejeitado, 404) seguem o mesmo padrão visual (cores, cards, tipografia).

## Performance

Resultados e análise em [`lighthouse/RESULTS.md`](lighthouse/RESULTS.md).
