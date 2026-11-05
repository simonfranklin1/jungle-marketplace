/** Endereço do servidor de eventos. Com mocks ativos, o MSW intercepta este WebSocket. */
export const REALTIME_URL: string = import.meta.env.VITE_REALTIME_URL ?? 'wss://realtime.kurio.test'
