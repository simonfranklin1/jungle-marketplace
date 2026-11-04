import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { queryClient } from '@/api/query-client'
import { createAppRouter } from '@/router'
import { bootstrapAuth } from '@/features/auth/auth-actions'
import { configureMockRecovery } from '@/api/client'
import './index.css'

/**
 * O backend é 100% simulado pelo MSW (REST + Socket.IO), inclusive no deploy público.
 * VITE_ENABLE_MOCKS=false permite apontar para uma API real via VITE_API_URL.
 */
async function enableMocking() {
  if (import.meta.env.VITE_ENABLE_MOCKS === 'false') return
  const [{ worker }, scenario, dbModule] = await Promise.all([
    import('./mocks/browser'),
    import('./mocks/scenario'),
    import('./mocks/db'),
  ])
  const { reset } = scenario.applyScenarioFromUrl()
  if (reset) dbModule.resetDb()
  const options = {
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: '/mockServiceWorker.js' },
  } as const
  await worker.start(options)
  configureMockRecovery(async () => {
    worker.stop()
    await worker.start({ ...options, quiet: true })
  })
}

const router = createAppRouter(queryClient)

enableMocking().then(() => {
  bootstrapAuth()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
})
