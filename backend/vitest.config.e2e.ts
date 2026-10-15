import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // De a un archivo: cada uno levanta la API y sincroniza la base; en paralelo se pisan.
    fileParallelism: false,
    // Los tests actúan con el encabezado X-Usuario-Id (sin login): ver AuthGuard.
    env: { AUTH_ENCABEZADO_PRUEBAS: 'true' },
  },
});
