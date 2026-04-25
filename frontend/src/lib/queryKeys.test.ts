/**
 * Garante que as keys são estáveis (mesmo input → mesma key) e que a
 * hierarquia permite invalidar tudo, só listas, ou só uma conversa.
 */

import { describe, expect, it } from 'vitest'

import { conversationKeys, leadKeys } from './queryKeys'

describe('conversationKeys', () => {
  it('all is the root scope', () => {
    expect(conversationKeys.all).toEqual(['conversations'])
  })

  it('lists() é prefixada por all', () => {
    expect(conversationKeys.lists()).toEqual(['conversations', 'list'])
  })

  it('list() inclui filtros como objeto', () => {
    expect(conversationKeys.list({ status: 'qualified', limit: 10 })).toEqual([
      'conversations',
      'list',
      { status: 'qualified', limit: 10 },
    ])
  })

  it('detail(id) é única por id', () => {
    expect(conversationKeys.detail('a')).not.toEqual(conversationKeys.detail('b'))
    expect(conversationKeys.detail('a')).toEqual(['conversations', 'detail', 'a'])
  })

  it('messages(id) é prefixada pelo detail(id)', () => {
    const detail = conversationKeys.detail('abc')
    const messages = conversationKeys.messages('abc')
    expect(messages.slice(0, detail.length)).toEqual(detail)
  })
})

describe('leadKeys', () => {
  it('detail(id) é estável', () => {
    expect(leadKeys.detail('xyz')).toEqual(['leads', 'detail', 'xyz'])
  })
})
