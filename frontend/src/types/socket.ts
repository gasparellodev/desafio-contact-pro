import type { ConnectionState, Conversation, Lead, Message } from './domain'

// Eventos enviados pelo servidor para o cliente.
export interface ServerToClientEvents {
  'wa.connection.update': (data: { state: ConnectionState; statusReason?: number }) => void
  'wa.qrcode.updated': (data: { qrcode: string | null }) => void

  'wa.message.received': (data: Message) => void
  'wa.audio.received': (data: Message) => void
  'wa.message.received.raw': (data: {
    id: string
    remote_jid: string
    from_me: boolean
    type: 'text' | 'audio' | 'image'
    text: string
    has_media: boolean
    media_mime: string | null
  }) => void

  'audio.transcribed': (data: { messageId: string; transcription: string }) => void
  'ai.thinking': (data: { conversationId: string; status: 'start' | 'end' }) => void
  'ai.response.generated': (data: Message) => void

  'wa.message.sent': (data: Message) => void
  'wa.audio.sent': (data: Message) => void
  'wa.reaction.sent': (data: { messageId: string; emoji: string }) => void

  'lead.updated': (data: Lead) => void
  'conversation.status_changed': (data: Partial<Conversation> & { id: string }) => void

  error: (data: { code?: string; message: string; conversation_id?: string }) => void
}

// Eventos enviados pelo cliente para o servidor.
export interface ClientToServerEvents {
  join_conversation: (data: { conversation_id: string }) => void
  leave_conversation: (data: { conversation_id: string }) => void
}
