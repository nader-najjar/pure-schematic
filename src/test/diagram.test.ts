import { expect, it } from 'vitest';
import { serializeDiagram } from '../main/diagram.ts';
import example from './fixtures/diagram.json';

it('retains native content and metadata without serializing temporary editor state or mutating it', () => {
  const document = {
    ...example,
    metadata: { author: 'human' },
    nodes: example.nodes.map((node) => ({
      ...node, selected: true, dragging: false, resizing: false, measured: { width: 150, height: 40 },
      style: { color: 'red' }, custom: { retained: true }
    })),
    edges: example.edges.map((edge) => ({ ...edge, selected: true, custom: 'retained' }))
  };
  const before = structuredClone(document);
  const saved: unknown = JSON.parse(serializeDiagram(document));
  expect(saved).toEqual({
    ...example,
    metadata: document.metadata,
    nodes: example.nodes.map((node) => ({ ...node, style: { color: 'red' }, custom: { retained: true } })),
    edges: example.edges.map((edge) => ({ ...edge, custom: 'retained' }))
  });
  expect(document).toEqual(before);
});
