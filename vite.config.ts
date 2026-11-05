import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { diagramPlugin } from './src/main/composition/DiagramPlugin.ts';

const diagrams = new URL('./src/main/diagrams/', import.meta.url);

export default defineConfig(({ command }) => ({
  root: 'src/main',
  base: './',
  plugins: [react(), diagramPlugin(diagrams, command)],
  build: {
    outDir: '../../build/release/idiomatic-artifacts',
    emptyOutDir: true
  }
}));
