/// <reference types="vitest" />
import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config'

// Reusa o vite.config.ts (alias `@/*`, plugin react, tailwindcss) e adiciona
// só o necessário para Vitest. Mantém uma fonte da verdade pra resolução de
// módulos.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/main.tsx',
          'src/test/**',
          'src/**/*.d.ts',
          'src/components/ui/**', // primitives shadcn copiados — não testar
          'src/routes/**', // cobertura via E2E Playwright (Spec C)
          'src/lib/socket.ts', // singleton trivial (io(url, opts))
          'src/lib/query-client.ts', // factory chamada via useState lazy
        ],
        // Thresholds calibrados pelo estado atual (Phase 4): hooks/providers/lib/
        // components com cobertura sólida. Rotas excluídas (E2E cuidam). Qualquer
        // PR futuro deve manter ou subir; baixar exige justificativa.
        thresholds: {
          statements: 80,
          branches: 60,
          functions: 80,
          lines: 80,
        },
      },
    },
  })
)
