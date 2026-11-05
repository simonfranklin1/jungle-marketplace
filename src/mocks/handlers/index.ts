import { realtimeHandler } from '../realtime'
import { authHandlers } from './auth'
import { cartHandlers } from './cart'
import { catalogHandlers } from './catalog'
import { devHandlers } from './dev'
import { networkHandlers } from './network'
import { orderHandlers } from './orders'
import { profileHandlers } from './profile'

export const handlers = [
  ...networkHandlers,
  ...authHandlers,
  ...catalogHandlers,
  ...cartHandlers,
  ...orderHandlers,
  ...profileHandlers,
  ...devHandlers,
  realtimeHandler,
]
