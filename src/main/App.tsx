import { Background, Controls, MarkerType, ReactFlow } from '@xyflow/react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import example from '../../diagrams/example.json';
import { Editor } from './Editor.tsx';
import type { OpenDiagram } from './Editor.tsx';
import '@xyflow/react/dist/style.css';

export function App(): ReactElement {
  const [opened, setOpened] = useState<OpenDiagram>({ name: 'example.json', diagram: example, isNew: false });
  const [generation, setGeneration] = useState(0);

  function open(next: OpenDiagram): void {
    setOpened(next);
    setGeneration((current) => current + 1);
  }

  return (
    <main>
      <header>
        <h1>Pure Schematic</h1>
        <p>
          {import.meta.env.DEV
            ? 'Arrange nodes, connect their handles, and select a node or connection to edit its label.'
            : 'Pan and zoom to explore the diagram.'}
        </p>
      </header>
      <section className="diagram" aria-label="Diagram canvas">
        <ReactFlow
          key={generation}
          defaultNodes={opened.diagram.nodes}
          defaultEdges={opened.diagram.edges}
          defaultViewport={opened.diagram.viewport}
          defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
          fitView={!import.meta.env.DEV}
          nodesDraggable={import.meta.env.DEV}
          nodesConnectable={import.meta.env.DEV}
          deleteKeyCode={import.meta.env.DEV ? ['Backspace', 'Delete'] : null}
        >
          {import.meta.env.DEV && <Editor opened={opened} onOpen={open} />}
          <Background />
          <Controls showInteractive={import.meta.env.DEV} />
        </ReactFlow>
      </section>
    </main>
  );
}
