import { http, HttpResponse } from 'msw'
import { resetDb } from '../db'
import { API, apiError } from '../http-utils'
import { connectionCount, qaDisconnect, qaDuplicate, qaPriceChange, qaStale, qaStockChange } from '../realtime'
import { SCENARIOS, setScenario, type ScenarioId } from '../scenario'

/**
 * Ferramentas de QA do backend simulado. Os eventos continuam saindo do "servidor" pelo
 * Socket.IO: a UI nunca injeta eventos diretamente no próprio estado.
 */
export const devHandlers = [
  http.post(`${API}/__dev/realtime`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string
      nftId?: string
      editionId?: string
      available?: number
    }
    const nftId = body.nftId ?? 'emerald-ape-042'
    switch (body.action) {
      case 'price':
        return HttpResponse.json({ event: qaPriceChange(nftId) })
      case 'stock':
        return HttpResponse.json({ event: qaStockChange(nftId, body.editionId ?? '1-50', body.available ?? 0) })
      case 'duplicate':
        return HttpResponse.json({ event: qaDuplicate() })
      case 'stale':
        return HttpResponse.json({ event: qaStale(nftId) })
      case 'disconnect':
        return HttpResponse.json({ closed: qaDisconnect() })
      case 'status':
        return HttpResponse.json({ connections: connectionCount() })
      default:
        return apiError('VALIDATION', 'Ação desconhecida.')
    }
  }),

  http.post(`${API}/__dev/scenario`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { scenario?: string; reset?: boolean }
    if (body.reset) resetDb()
    if (body.scenario) {
      if (!(body.scenario in SCENARIOS)) return apiError('VALIDATION', 'Cenário desconhecido.')
      setScenario(body.scenario as ScenarioId)
    }
    return new HttpResponse(null, { status: 204 })
  }),
]
