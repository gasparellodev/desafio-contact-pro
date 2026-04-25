import { useEffect, useReducer, useState } from 'react'

import { socket } from '@/lib/socket'
import type { Conversation, Lead, Message } from '@/types/domain'

interface ConvWithDetails {
  conversation: Conversation
  lead: Lead
  messages: Message[]
}

interface State {
  byId: Record<string, ConvWithDetails>
  order: string[] // conversation ids ordered by last_message_at desc
  thinkingByConv: Record<string, boolean>
}

type Action =
  | { type: 'message_received'; payload: Message }
  | { type: 'message_sent'; payload: Message }
  | { type: 'audio_transcribed'; payload: { messageId: string; transcription: string } }
  | { type: 'lead_updated'; payload: Lead }
  | { type: 'conversation_updated'; payload: Partial<Conversation> & { id: string } }
  | { type: 'thinking'; payload: { conversationId: string; status: 'start' | 'end' } }

const initialState: State = { byId: {}, order: [], thinkingByConv: {} }

function ensureConversation(state: State, conversationId: string, lead?: Lead): State {
  if (state.byId[conversationId]) return state
  const placeholderLead: Lead =
    lead ??
    ({
      id: `lead-pending-${conversationId}`,
      whatsapp_jid: '',
      name: null,
      company: null,
      phone: null,
      service_interest: 'unknown',
      lead_goal: null,
      estimated_volume: null,
      status: 'new',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } satisfies Lead)
  return {
    ...state,
    byId: {
      ...state.byId,
      [conversationId]: {
        conversation: {
          id: conversationId,
          lead_id: placeholderLead.id,
          last_intent: null,
          last_message_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
        lead: placeholderLead,
        messages: [],
      },
    },
    order: [conversationId, ...state.order.filter((id) => id !== conversationId)],
  }
}

function appendMessage(state: State, msg: Message): State {
  const cid = msg.conversation_id
  const next = ensureConversation(state, cid)
  const existing = next.byId[cid].messages
  if (existing.some((m) => m.id === msg.id)) return next
  return {
    ...next,
    byId: {
      ...next.byId,
      [cid]: {
        ...next.byId[cid],
        conversation: {
          ...next.byId[cid].conversation,
          last_message_at: msg.created_at,
        },
        messages: [...existing, msg],
      },
    },
    order: [cid, ...next.order.filter((id) => id !== cid)],
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'message_received':
    case 'message_sent':
      return appendMessage(state, action.payload)
    case 'audio_transcribed': {
      const next = { ...state, byId: { ...state.byId } }
      for (const cid of Object.keys(next.byId)) {
        const conv = next.byId[cid]
        const idx = conv.messages.findIndex((m) => m.id === action.payload.messageId)
        if (idx >= 0) {
          const updated = [...conv.messages]
          updated[idx] = { ...updated[idx], transcription: action.payload.transcription }
          next.byId[cid] = { ...conv, messages: updated }
          break
        }
      }
      return next
    }
    case 'lead_updated': {
      const lead = action.payload
      const cid = Object.keys(state.byId).find((id) => state.byId[id].lead.id === lead.id || state.byId[id].lead.whatsapp_jid === lead.whatsapp_jid)
      if (!cid) return state
      return {
        ...state,
        byId: {
          ...state.byId,
          [cid]: { ...state.byId[cid], lead },
        },
      }
    }
    case 'conversation_updated': {
      const { id, ...patch } = action.payload
      const conv = state.byId[id]
      if (!conv) return state
      return {
        ...state,
        byId: {
          ...state.byId,
          [id]: { ...conv, conversation: { ...conv.conversation, ...patch } },
        },
      }
    }
    case 'thinking':
      return {
        ...state,
        thinkingByConv: {
          ...state.thinkingByConv,
          [action.payload.conversationId]: action.payload.status === 'start',
        },
      }
    default:
      return state
  }
}

export function useConversations() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const onMessageReceived = (msg: Message) => dispatch({ type: 'message_received', payload: msg })
    const onMessageSent = (msg: Message) => dispatch({ type: 'message_sent', payload: msg })
    const onAiResponse = (msg: Message) => dispatch({ type: 'message_sent', payload: msg })
    const onAudioReceived = (msg: Message) => dispatch({ type: 'message_received', payload: msg })
    const onAudioTranscribed = (data: { messageId: string; transcription: string }) =>
      dispatch({ type: 'audio_transcribed', payload: data })
    const onLeadUpdated = (lead: Lead) => dispatch({ type: 'lead_updated', payload: lead })
    const onConv = (data: Partial<Conversation> & { id: string }) =>
      dispatch({ type: 'conversation_updated', payload: data })
    const onThinking = (data: { conversationId: string; status: 'start' | 'end' }) =>
      dispatch({ type: 'thinking', payload: data })

    socket.on('wa.message.received', onMessageReceived)
    socket.on('wa.audio.received', onAudioReceived)
    socket.on('audio.transcribed', onAudioTranscribed)
    socket.on('wa.message.sent', onMessageSent)
    socket.on('wa.audio.sent', onMessageSent)
    socket.on('ai.response.generated', onAiResponse)
    socket.on('lead.updated', onLeadUpdated)
    socket.on('conversation.status_changed', onConv)
    socket.on('ai.thinking', onThinking)

    return () => {
      socket.off('wa.message.received', onMessageReceived)
      socket.off('wa.audio.received', onAudioReceived)
      socket.off('audio.transcribed', onAudioTranscribed)
      socket.off('wa.message.sent', onMessageSent)
      socket.off('wa.audio.sent', onMessageSent)
      socket.off('ai.response.generated', onAiResponse)
      socket.off('lead.updated', onLeadUpdated)
      socket.off('conversation.status_changed', onConv)
      socket.off('ai.thinking', onThinking)
    }
  }, [])

  const conversations = state.order.map((id) => state.byId[id])
  const active = activeId ? state.byId[activeId] : conversations[0]
  const thinkingActive = active ? state.thinkingByConv[active.conversation.id] === true : false

  return {
    conversations,
    active,
    activeId: active?.conversation.id ?? null,
    setActiveId,
    thinkingActive,
  }
}
