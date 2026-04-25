/**
 * SocketProvider — gerencia o ciclo de vida do socket singleton e mescla os
 * eventos no cache do TanStack Query.
 *
 * Por que ser provider e não um hook qualquer? Porque o singleton é uma
 * recurso compartilhado da aplicação inteira: qualquer componente que precise
 * do socket (status conexão, indicador "IA pensando") consome via Context, e
 * o ciclo de connect/disconnect acontece UMA vez no boundary da árvore.
 *
 * Eventos do Socket.IO **não causam refetch**. Eles atualizam o cache via
 * `queryClient.setQueryData(...)`. A lista de conversas pode ser invalidada
 * para reordenar por `last_message_at`, o que dispara um refetch leve (a
 * última atividade já foi capturada no cache pela mensagem que chegou).
 */

import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { conversationKeys, leadKeys } from '@/lib/queryKeys'
import { socket } from '@/lib/socket'
import type {
  ConnectionState,
  ConversationListResponse,
  Lead,
  MessagePageResponse,
  Message,
} from '@/types/domain'

import { SocketContext } from './socket-context'

interface SocketProviderProps {
  children: ReactNode
}

function appendMessageToCache(queryClient: QueryClient, msg: Message) {
  const key = conversationKeys.messages(msg.conversation_id)
  queryClient.setQueryData<MessagePageResponse | undefined>(key, (prev) => {
    if (!prev) {
      // Nada cacheado ainda: deixa pra próxima leitura via REST.
      return prev
    }
    if (prev.items.some((m) => m.id === msg.id)) return prev
    return { ...prev, items: [...prev.items, msg] }
  })

  // Sinaliza pra lista revalidar (ordem por last_message_at).
  queryClient.invalidateQueries({ queryKey: conversationKeys.lists() })
}

function patchTranscriptionInCache(
  queryClient: QueryClient,
  payload: { messageId: string; transcription: string }
) {
  // Percorre apenas as mensagens já cacheadas (não força fetch).
  const caches = queryClient.getQueriesData<MessagePageResponse>({
    queryKey: conversationKeys.all,
  })
  for (const [key, page] of caches) {
    if (!page) continue
    const idx = page.items.findIndex((m) => m.id === payload.messageId)
    if (idx < 0) continue
    const next = { ...page, items: [...page.items] }
    next.items[idx] = { ...next.items[idx], transcription: payload.transcription }
    queryClient.setQueryData(key, next)
    return
  }
}

function patchLeadInCache(queryClient: QueryClient, lead: Lead) {
  queryClient.setQueryData(leadKeys.detail(lead.id), lead)
  // Atualiza também o LeadSummary embutido na lista de conversas (para refletir status).
  queryClient.setQueriesData<ConversationListResponse>(
    { queryKey: conversationKeys.lists() },
    (prev) => {
      if (!prev) return prev
      const items = prev.items.map((item) =>
        item.lead.id === lead.id || item.lead.whatsapp_jid === lead.whatsapp_jid
          ? {
              ...item,
              lead: {
                ...item.lead,
                name: lead.name,
                phone: lead.phone,
                service_interest: lead.service_interest,
                status: lead.status,
              },
            }
          : item
      )
      return { ...prev, items }
    }
  )
}

export function SocketProvider({ children }: SocketProviderProps) {
  const queryClient = useQueryClient()
  const [connected, setConnected] = useState(socket.connected)
  const [waState, setWaState] = useState<ConnectionState>('unknown')
  const [qrcode, setQrcode] = useState<string | null>(null)
  const [thinking, setThinking] = useState<Record<string, boolean>>({})
  // Ref pra evitar disconnect prematuro no double-mount do StrictMode.
  const mountCountRef = useRef(0)

  useEffect(() => {
    mountCountRef.current += 1

    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    const onWaConnection = (data: { state: ConnectionState }) => {
      setWaState(data.state)
      if (data.state === 'open') setQrcode(null)
    }
    const onQr = (data: { qrcode: string | null }) => setQrcode(data.qrcode)
    const onMessage = (m: Message) => appendMessageToCache(queryClient, m)
    const onAudioTranscribed = (data: { messageId: string; transcription: string }) =>
      patchTranscriptionInCache(queryClient, data)
    const onLeadUpdated = (lead: Lead) => patchLeadInCache(queryClient, lead)
    const onConvUpdated = () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() })
    }
    const onThinking = (data: { conversationId: string; status: 'start' | 'end' }) =>
      setThinking((prev) => ({ ...prev, [data.conversationId]: data.status === 'start' }))

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('wa.connection.update', onWaConnection)
    socket.on('wa.qrcode.updated', onQr)
    socket.on('wa.message.received', onMessage)
    socket.on('wa.audio.received', onMessage)
    socket.on('audio.transcribed', onAudioTranscribed)
    socket.on('wa.message.sent', onMessage)
    socket.on('wa.audio.sent', onMessage)
    socket.on('ai.response.generated', onMessage)
    socket.on('lead.updated', onLeadUpdated)
    socket.on('conversation.status_changed', onConvUpdated)
    socket.on('ai.thinking', onThinking)

    if (!socket.connected) socket.connect()

    return () => {
      mountCountRef.current -= 1
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('wa.connection.update', onWaConnection)
      socket.off('wa.qrcode.updated', onQr)
      socket.off('wa.message.received', onMessage)
      socket.off('wa.audio.received', onMessage)
      socket.off('audio.transcribed', onAudioTranscribed)
      socket.off('wa.message.sent', onMessage)
      socket.off('wa.audio.sent', onMessage)
      socket.off('ai.response.generated', onMessage)
      socket.off('lead.updated', onLeadUpdated)
      socket.off('conversation.status_changed', onConvUpdated)
      socket.off('ai.thinking', onThinking)
      // Não chama disconnect: StrictMode em dev faz mount→unmount→mount; deixar
      // o singleton vivo evita reconexão imediata. O socket.io-client gerencia
      // reconexão automaticamente em produção quando a aba é fechada.
    }
  }, [queryClient])

  const value = useMemo(
    () => ({ connected, waState, qrcode, thinking }),
    [connected, waState, qrcode, thinking]
  )

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}
