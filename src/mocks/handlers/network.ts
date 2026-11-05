import { delay, http, HttpResponse } from 'msw'
import { API } from '../http-utils'
import { getScenario } from '../scenario'

/**
 * Condições de rede aplicadas antes de qualquer handler. Retornar undefined deixa a
 * requisição seguir para o handler específico. Ferramentas /__dev nunca são afetadas.
 */
const JITTER = [900, 120, 600, 250, 1400, 60, 800, 350]
let jitterIndex = 0

export const networkHandlers = [
  http.all(`${API}/*`, async ({ request }) => {
    if (new URL(request.url).pathname.startsWith(`${API}/__dev`)) return undefined
    const scenario = getScenario()
    if (scenario === 'offline') return HttpResponse.error()
    if (scenario === 'variable-latency') {
      // sequência fixa: a mesma ordem de latências em toda execução (reprodutível)
      await delay(JITTER[jitterIndex++ % JITTER.length])
    }
    return undefined
  }),
]
