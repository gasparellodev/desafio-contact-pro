/**
 * Setup global do Vitest:
 * - habilita matchers do jest-dom (toBeInTheDocument, toHaveAttribute, etc.)
 * - faz cleanup do DOM após cada teste (Testing Library 16 não auto-cleana)
 *
 * Mocks de Socket.IO, MSW handlers e factories vão ser adicionados nas fases
 * que introduzirem componentes que dependem deles (Spec A — Phase 2+).
 */

import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
