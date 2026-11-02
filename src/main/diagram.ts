import type { ReactFlowJsonObject } from '@xyflow/react';

// Keep native document fields while omitting temporary editor state.
export function serializeDiagram(diagram: ReactFlowJsonObject): string {
  return JSON.stringify({
    ...diagram,
    nodes: diagram.nodes.map((node) => {
      const saved = { ...node };
      delete saved.selected;
      delete saved.dragging;
      delete saved.measured;
      delete saved.resizing;
      return saved;
    }),
    edges: diagram.edges.map((edge) => {
      const saved = { ...edge };
      delete saved.selected;
      return saved;
    })
  });
}

export async function diagramRevision(document: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(document));
  return '"' + [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('') + '"';
}
