import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // só repete falhas transitórias; 404/422/401 são definitivos
      retry: (count, error) => error instanceof ApiError && error.isTransient && count < 2,
      retryDelay: (n) => Math.min(500 * 2 ** n, 3000),
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
})
