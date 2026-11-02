import { useEdges, useNodes, useReactFlow } from '@xyflow/react';
import type { ReactElement } from 'react';

export function EditControls(): ReactElement {
  const nodes = useNodes();
  const edges = useEdges();
  const {
    addNodes, setNodes, setEdges, updateNodeData, updateEdge, deleteElements, screenToFlowPosition
  } = useReactFlow();
  const selectedNodes = nodes.filter((node) => node.selected === true);
  const selectedEdges = edges.filter((edge) => edge.selected === true);
  const selected = selectedNodes.length + selectedEdges.length === 1 ? selectedNodes[0] ?? selectedEdges[0] : undefined;
  const label = selectedNodes[0]?.data['label'] ?? selectedEdges[0]?.label;
  const initialLabel = typeof label === 'string' || typeof label === 'number' ? String(label) : '';

  function addNode(): void {
    setNodes((current) => current.map((node) => ({ ...node, selected: false })));
    setEdges((current) => current.map((edge) => ({ ...edge, selected: false })));
    const position = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    while (nodes.some((node) => node.position.x === position.x && node.position.y === position.y)) {
      position.x += 40;
      position.y += 40;
    }
    addNodes({
      id: crypto.randomUUID(),
      data: { label: 'New node' },
      position,
      selected: true
    });
  }

  return (
    <div className="edit-controls">
      <button type="button" onClick={addNode}>Add node</button>
      <button
        type="button"
        disabled={selectedNodes.length + selectedEdges.length === 0}
        onClick={() => { void deleteElements({ nodes: selectedNodes, edges: selectedEdges }); }}
      >
        Delete selected
      </button>
      {selected !== undefined && (
        <form
          key={selected.id}
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get('label');
            if (typeof value !== 'string' || value === initialLabel) return;
            if (selectedNodes.length === 1) updateNodeData(selected.id, { label: value });
            else updateEdge(selected.id, { label: value });
          }}
        >
          <label>
            Label
            <input name="label" defaultValue={initialLabel} />
          </label>
          <button type="submit">Apply label</button>
          <button type="reset">Cancel</button>
        </form>
      )}
    </div>
  );
}
