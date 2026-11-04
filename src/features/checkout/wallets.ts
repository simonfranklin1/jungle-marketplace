import type { WalletType } from '@/api/types'

export const WALLETS: { id: WalletType; label: string }[] = [
  { id: 'metamask', label: 'MetaMask' },
  { id: 'walletconnect', label: 'WalletConnect' },
  { id: 'coinbase', label: 'Coinbase Wallet' },
]
