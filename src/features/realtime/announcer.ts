/** Região aria-live global: leitores de tela ouvem mutações e atualizações em tempo real. */
let message = ''
const listeners = new Set<() => void>()

export function announce(text: string) {
  // limpa antes para que mensagens repetidas sejam lidas de novo
  message = ''
  listeners.forEach((l) => l())
  setTimeout(() => {
    message = text
    listeners.forEach((l) => l())
  }, 50)
}

export const announcerStore = {
  get: () => message,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}
