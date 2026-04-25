import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { runAxe } from '@/test/test-utils'

import {
  ConversationListSkeleton,
  MessageListSkeleton,
  RouteFallbackSkeleton,
} from './Skeletons'

describe('Skeletons (a11y + estrutura)', () => {
  it('ConversationListSkeleton expõe aria-busy', () => {
    const { container } = render(<ConversationListSkeleton rows={3} />)
    const list = container.querySelector('[aria-busy="true"]')
    expect(list).not.toBeNull()
    // 3 itens
    expect(container.querySelectorAll('li').length).toBe(3)
  })

  it('MessageListSkeleton expõe aria-busy', () => {
    const { container } = render(<MessageListSkeleton />)
    const region = container.querySelector('[aria-busy="true"]')
    expect(region).not.toBeNull()
  })

  it('RouteFallbackSkeleton passa axe sem violations', async () => {
    const { container } = render(<RouteFallbackSkeleton />)
    const result = await runAxe(container)
    expect(result.violations).toEqual([])
  })
})
