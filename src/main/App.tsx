import { Background, Controls, MarkerType, ReactFlow } from '@xyflow/react';
import type { ReactFlowJsonObject } from '@xyflow/react';
import type { ReactElement } from 'react';
import example from '../../diagrams/example.json';
import '@xyflow/react/dist/style.css';

const initialFlow: ReactFlowJsonObject = example;

export function App(): ReactElement {
  return (
    <main>
      <header>
        <h1>Pure Schematic</h1>
        <p>Drag nodes to arrange the diagram. Changes last until you reload.</p>
      </header>
      <section className="diagram" aria-label="Example diagram">
        <ReactFlow
          defaultNodes={initialFlow.nodes}
          defaultEdges={initialFlow.edges}
          defaultViewport={initialFlow.viewport}
          defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </section>
    </main>
  );
}
