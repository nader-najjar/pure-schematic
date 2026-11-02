import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { diagramNames, localDiagrams, readDiagram } from './local-diagrams.ts';

const diagrams = new URL('./diagrams/', import.meta.url);

export default defineConfig(({ command }) => ({
  root: 'src/main',
  base: './',
  plugins: [
    react(),
    {
      name: 'local-diagrams',
      async buildStart(): Promise<void> {
        if (command === 'build') {
          for (const name of await diagramNames(diagrams)) {
            try {
              await readDiagram(new URL(name, diagrams));
            } catch (error) {
              throw new Error(`Invalid diagram: diagrams/${name}`, { cause: error });
            }
          }
        }
      },
      configureServer(server): void {
        server.middlewares.use(
          '/__schematic/diagrams',
          localDiagrams(diagrams)
        );
      }
    }
  ],
  build: {
    outDir: '../../build/release/idiomatic-artifacts',
    emptyOutDir: true
  }
}));
