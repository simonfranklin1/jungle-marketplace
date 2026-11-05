import { lazy, Suspense, useState } from 'react'
import { useAuthDialog } from './session-store'

const AuthDialog = lazy(() => import('./AuthDialog').then((m) => ({ default: m.AuthDialog })))

/** O modal (e o Base UI Dialog) só é baixado na primeira vez que alguém abre o login. */
export function LazyAuthDialog() {
  const { open } = useAuthDialog()
  const [loaded, setLoaded] = useState(open)
  if (open && !loaded) setLoaded(true)
  if (!loaded) return null
  return (
    <Suspense fallback={null}>
      <AuthDialog />
    </Suspense>
  )
}
