import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/main',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../../build/release/idiomatic-artifacts',
    emptyOutDir: true
  }
});
