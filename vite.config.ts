import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    exclude: ['**/.next/**', '**/dist/**', '**/node_modules/**'],
    setupFiles: './src/test/setup.ts',
  },
})
