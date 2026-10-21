import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['app/**/*.test.{ts,tsx}'],
    // Artifact logic is kept pure, so plain Node is enough.
    environment: 'node',
  },
})
