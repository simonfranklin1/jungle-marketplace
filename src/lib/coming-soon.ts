import { toast } from 'sonner'

/** Ações fora do escopo: deixam claro que não fazem parte desta versão (nunca simulam sucesso). */
export function comingSoon(label: string) {
  toast.info(`${label} não faz parte desta versão do marketplace.`)
}
