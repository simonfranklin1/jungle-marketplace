import { authHandlers } from './auth'
import { cartHandlers } from './cart'
import { catalogHandlers } from './catalog'

export const handlers = [...authHandlers, ...catalogHandlers, ...cartHandlers]
