import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/test/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    globals: false,
    restoreMocks: true,
    mockReset: true,
    unstubEnvs: true,
    unstubGlobals: true,
    passWithNoTests: false,
    allowOnly: false,
    reporters: ['default', 'junit'],
    outputFile: { junit: 'build/quality-reports/tests/junit.xml' },
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/main/**/*.{ts,tsx}'],
      exclude: ['src/main/Main.tsx'],
      reportsDirectory: 'build/quality-reports/coverage',
      reporter: ['text', 'html', 'lcov'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 }
    }
  }
});
