import { setupWorker } from 'msw/browser'
import { catalogHandlers } from './handlers/catalog'

export const worker = setupWorker(...catalogHandlers)
