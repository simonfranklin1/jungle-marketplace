import { useSyncExternalStore } from 'react'
import { announcerStore } from './announcer'

export function LiveAnnouncer() {
  const text = useSyncExternalStore(announcerStore.subscribe, announcerStore.get, announcerStore.get)
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="live-announcer">
      {text}
    </div>
  )
}
