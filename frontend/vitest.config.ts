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
        ],
        thresholds: {
          // Phase 1 ainda sem testes; thresholds reais entram na Phase 5.
          // Mantemos a chave aqui só de placeholder para a infraestrutura.
        },
      },
    },
  })
)
