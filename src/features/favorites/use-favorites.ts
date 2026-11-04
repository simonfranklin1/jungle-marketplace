import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, isApiError } from '@/api/client'
import { meKeys } from '@/api/me'
import { queryClient } from '@/api/query-client'
import { authDialog, sessionStore, useUser } from '@/features/auth/session-store'

/** Favoritos persistem no servidor e só existem para usuários autenticados. */
export function useFavorites() {
  const user = useUser()
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: meKeys.favorites(user?.id ?? 'anon'),
    queryFn: ({ signal }) => api.get<string[]>('/favorites', { signal }).then((r) => r.data),
    enabled: !!user,
    staleTime: 60_000,
  })

  const mutation = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean; uid: string }) =>
      (on ? api.put<string[]>(`/favorites/${id}`) : api.delete<string[]>(`/favorites/${id}`)).then((r) => r.data),
    onMutate: ({ id, on, uid }) => {
      const key = meKeys.favorites(uid)
      const previous = qc.getQueryData<string[]>(key) ?? []
      qc.setQueryData<string[]>(key, on ? [...new Set([...previous, id])] : previous.filter((x) => x !== id))
      return { previous, key }
    },
    onError: (e, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.previous)
      if (isApiError(e, 'SESSION_EXPIRED') || isApiError(e, 'UNAUTHORIZED')) return
      toast.error('Não foi possível atualizar seus favoritos.')
    },
    onSuccess: (data, { on }, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, data)
      toast.success(on ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.')
    },
  })

  const ids = query.data ?? []
  return {
    ids,
    isFavorite: (id: string) => ids.includes(id),
    pending: mutation.isPending,
    toggle(id: string) {
      if (!user) {
        authDialog.open('login', 'Entre para salvar NFTs nos seus favoritos.', () => void favoriteAfterLogin(id))
        return
      }
      mutation.mutate({ id, on: !ids.includes(id), uid: user.id })
    },
  }
}

async function favoriteAfterLogin(id: string) {
  const uid = sessionStore.get()?.user.id
  if (!uid) return
  try {
    const { data } = await api.put<string[]>(`/favorites/${id}`)
    queryClient.setQueryData(meKeys.favorites(uid), data)
    toast.success('Adicionado aos favoritos.')
  } catch {
    toast.error('Não foi possível favoritar.')
  }
}
