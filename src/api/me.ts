/**
 * Dados privados do usuário. Toda chave começa com ['me', userId] para que:
 * - o cache de um usuário nunca seja lido por outro;
 * - logout/troca de usuário removam tudo com um único removeQueries(['me']).
 */
export const meKeys = {
  all: ['me'] as const,
  user: (uid: string) => ['me', uid] as const,
  cart: (uid: string) => ['me', uid, 'cart'] as const,
  favorites: (uid: string) => ['me', uid, 'favorites'] as const,
  orders: (uid: string) => ['me', uid, 'orders'] as const,
  order: (uid: string, id: string) => ['me', uid, 'orders', id] as const,
  profile: (uid: string) => ['me', uid, 'profile'] as const,
  wallets: (uid: string) => ['me', uid, 'wallets'] as const,
}
