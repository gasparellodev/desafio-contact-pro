// Wrapper minimalista para REST. TanStack Query consome estes fetchers
// (ver hooks/use*.ts).

import type {
  ConnectionState,
  ConversationDetail,
  ConversationListResponse,
  Lead,
  MessagePageResponse,
  WhatsAppConnectionResponse,
} from '@/types/domain'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// Admin token: requerido por /api/whatsapp/*, /api/conversations/*, /api/leads/*.
// Vazio = requests recebem 401/503 do backend.
const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN ?? ''

const ADMIN_PREFIXES = ['/api/whatsapp', '/api/conversations', '/api/leads']

function needsAdminAuth(path: string): boolean {
  return ADMIN_PREFIXES.some((p) => path.startsWith(p))
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  }
  if (needsAdminAuth(path) && ADMIN_TOKEN) {
    headers['X-Admin-Token'] = ADMIN_TOKEN
  }
  const res = await fetch(url, { ...init, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText} — ${text || path}`)
  }
  if (res.status === 204) return null as T
  return res.json() as Promise<T>
}

// ---------- Typed fetchers (consumidos pelos hooks de TanStack Query) ----------

export interface ListConversationsParams {
  status?: string
  q?: string
  limit?: number
  offset?: number
}

export async function fetchConversations(
  params: ListConversationsParams = {}
): Promise<ConversationListResponse> {
  const search = new URLSearchParams()
  if (params.status) search.set('status', params.status)
  if (params.q) search.set('q', params.q)
  if (params.limit !== undefined) search.set('limit', String(params.limit))
  if (params.offset !== undefined) search.set('offset', String(params.offset))
  const qs = search.toString()
  return api<ConversationListResponse>(`/api/conversations${qs ? `?${qs}` : ''}`)
}

export async function fetchConversation(id: string): Promise<ConversationDetail> {
  return api<ConversationDetail>(`/api/conversations/${id}`)
}

export interface ListMessagesParams {
  before?: string
  beforeId?: string
  limit?: number
}

export async function fetchMessages(
  conversationId: string,
  params: ListMessagesParams = {}
): Promise<MessagePageResponse> {
  const search = new URLSearchParams()
  if (params.before) search.set('before', params.before)
  if (params.beforeId) search.set('before_id', params.beforeId)
  if (params.limit !== undefined) search.set('limit', String(params.limit))
  const qs = search.toString()
  return api<MessagePageResponse>(
    `/api/conversations/${conversationId}/messages${qs ? `?${qs}` : ''}`
  )
}

export async function fetchLead(id: string): Promise<Lead> {
  return api<Lead>(`/api/leads/${id}`)
}

/** Estado da conexão WhatsApp via backend proxy → Evolution.
 *
 * Evolution v2 devolve `{ instance: { instanceName, state } }`. Achatamos para
 * `{ state }` e tratamos 502 (proxy retorna `evolution unreachable`) como
 * `unknown` em vez de propagar o erro — UX prefere "estado indeterminado"
 * a quebrar a UI inteira.
 */
export async function fetchWhatsAppConnection(): Promise<WhatsAppConnectionResponse> {
  const KNOWN_STATES: readonly ConnectionState[] = ['open', 'connecting', 'close', 'unknown']
  try {
    const raw = await api<{ instance?: { state?: string } } & { state?: string }>(
      '/api/whatsapp/connection'
    )
    const candidate = raw?.instance?.state ?? raw?.state
    const state = KNOWN_STATES.includes(candidate as ConnectionState)
      ? (candidate as ConnectionState)
      : 'unknown'
    return { state }
  } catch (err) {
    // Evolution fora do ar (proxy 502) ou rede caiu — não quebra a UI.
    if (err instanceof Error && err.message.startsWith('502')) {
      return { state: 'unknown' }
    }
    throw err
  }
}
