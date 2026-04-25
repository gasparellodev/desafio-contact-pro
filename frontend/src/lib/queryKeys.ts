/**
 * Factory de query keys do TanStack Query.
 *
 * Convenção (recomendada pelo TanStack 5):
 * - Sempre arrays.
 * - O primeiro elemento é a "scope" (entidade).
 * - Filtros vêm como objeto no fim — facilita `invalidateQueries({ queryKey: conversationKeys.lists() })`.
 *
 * Centralizar evita typo silencioso e dá um lugar pro grep.
 */

export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  list: (filters: { status?: string; q?: string; limit?: number; offset?: number }) =>
    [...conversationKeys.lists(), filters] as const,
  details: () => [...conversationKeys.all, 'detail'] as const,
  detail: (id: string) => [...conversationKeys.details(), id] as const,
  messages: (id: string) => [...conversationKeys.detail(id), 'messages'] as const,
}

export const leadKeys = {
  all: ['leads'] as const,
  detail: (id: string) => [...leadKeys.all, 'detail', id] as const,
}
