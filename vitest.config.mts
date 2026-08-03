import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Solo los motores puros y la matriz de permisos. La UI y las consultas a
    // Supabase se prueban corriendo la app, no con unit tests.
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
})
