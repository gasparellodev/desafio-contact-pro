// Tipos compartilhados do domínio. Espelha os enums do backend (`backend/app/models/enums.py`).

export type LeadStatus = 'new' | 'qualified' | 'needs_human' | 'opt_out'

export type ServiceInterest =
  | 'contact_z'
  | 'contact_tel'
  | 'mailing'
  | 'data_enrichment'
  | 'unknown'

export type Intent =
  | 'contact_z'
  | 'contact_tel'
  | 'mailing'
  | 'data_enrichment'
  | 'pricing'
  | 'human_handoff'
  | 'opt_out'
  | 'support'
  | 'general_question'

export type Direction = 'in' | 'out'

export type MessageType = 'text' | 'audio' | 'image'

export type MessageStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'received'

export interface Lead {
  id: string
  whatsapp_jid: string
  name: string | null
  company: string | null
  phone: string | null
  service_interest: ServiceInterest
  lead_goal: string | null
  estimated_volume: string | null
  status: LeadStatus
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  lead_id: string
  last_intent: Intent | null
  last_message_at: string
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  whatsapp_message_id: string | null
  direction: Direction
  type: MessageType
  content: string
  transcription: string | null
  media_url: string | null
  media_mime: string | null
  intent: Intent | null
  status: MessageStatus
  quoted_message_id: string | null
  error_reason: string | null
  created_at: string
}

export type ConnectionState = 'open' | 'connecting' | 'close' | 'unknown'

// Schemas REST (espelha backend/app/schemas/{lead,conversation}.py).

export interface LeadSummary {
  id: string
  whatsapp_jid: string
  name: string | null
  phone: string | null
  service_interest: ServiceInterest
  status: LeadStatus
}

export interface ConversationListItem {
  id: string
  lead: LeadSummary
  last_intent: Intent | null
  last_message_at: string
  created_at: string
}

export type ConversationDetail = ConversationListItem

export interface ConversationListResponse {
  items: ConversationListItem[]
  total: number
  limit: number
  offset: number
}

export interface MessagePageResponse {
  items: Message[]
  next_before: string | null
  next_before_id: string | null
  limit: number
}

/** Resposta normalizada do backend `/api/whatsapp/connection`.
 * Internamente Evolution v2 devolve `{ instance: { state } }`; o fetcher
 * achata para esta forma plana antes de cachear.
 */
export interface WhatsAppConnectionResponse {
  state: ConnectionState
}
