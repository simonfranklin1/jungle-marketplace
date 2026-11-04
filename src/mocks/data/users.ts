import type { UserRecord } from '../db'

/**
 * Contas fictícias para avaliação (senha de ambas: Kurio@123).
 * Senhas nunca são guardadas em texto puro: só SHA-256 com salt.
 */
const DEMO_SALT = 'kurio-demo-salt'
const DEMO_HASH = '9dc920feb93f9f38c6e7a893652d4f0baf86bbf0cbc860696339ffaf8736c35d'

export const SEED_USERS: UserRecord[] = [
  {
    id: 'usr_demo',
    email: 'demo@kurio.test',
    displayName: 'Colecionador Demo',
    username: 'demo',
    ensName: 'demo',
    walletNickname: 'Carteira principal',
    avatarUrl: null,
    passwordSalt: DEMO_SALT,
    passwordHash: DEMO_HASH,
  },
  {
    id: 'usr_ana',
    email: 'ana@kurio.test',
    displayName: 'Ana Colecionadora',
    username: 'ana',
    ensName: 'ana',
    walletNickname: 'Ana principal',
    avatarUrl: null,
    passwordSalt: DEMO_SALT,
    passwordHash: DEMO_HASH,
  },
]

export async function hashPassword(password: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
