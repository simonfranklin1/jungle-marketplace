import { realtimeHandler } from '../realtime'
import { authHandlers } from './auth'
import { cartHandlers } from './cart'
import { catalogHandlers } from './catalog'
import { devHandlers } from './dev'
import { orderHandlers } from './orders'

export const handlers = [
  ...authHandlers,
  ...catalogHandlers,
  ...cartHandlers,
  ...orderHandlers,
  ...devHandlers,
  realtimeHandler,
]
