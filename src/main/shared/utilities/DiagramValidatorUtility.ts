import type { ReactFlowJsonObject } from '@xyflow/react';

// Check the native fields required by this editor without changing additional metadata.
export function isDiagram(value: unknown): value is ReactFlowJsonObject {
  if (!isObject(value)) {
    return false;
  }

  const { nodes, edges, viewport } = value;
  if (!Array.isArray(nodes) || !Array.isArray(edges) || !isViewport(viewport)) {
    return false;
  }

  const nodeIds = new Set<string>();
  for (const node of nodes as unknown[]) {
    if (!isNode(node, nodeIds)) {
      return false;
    }
    nodeIds.add(node.id);
  }

  const edgeIds = new Set<string>();
  for (const edge of edges as unknown[]) {
    if (!isEdge(edge, nodeIds, edgeIds)) {
      return false;
    }
    edgeIds.add(edge.id);
  }

  return true;
}

function isNode(
  value: unknown,
  precedingNodeIds: ReadonlySet<string>
): value is Record<string, unknown> & { id: string } {
  if (!isObject(value)) {
    return false;
  }

  const { id, position, data, parentId } = value;
  if (!isId(id) || precedingNodeIds.has(id) || !isPosition(position)
    || !isObject(data) || !isLabel(data['label'])) {
    return false;
  }

  // React Flow requires parents before children; this also rejects missing parents and cycles.
  return parentId === undefined || (typeof parentId === 'string' && precedingNodeIds.has(parentId));
}

function isEdge(
  value: unknown,
  nodeIds: ReadonlySet<string>,
  precedingEdgeIds: ReadonlySet<string>
): value is Record<string, unknown> & { id: string } {
  if (!isObject(value)) {
    return false;
  }

  const { id, source, target, label } = value;
  return isId(id) && !precedingEdgeIds.has(id)
    && typeof source === 'string' && nodeIds.has(source)
    && typeof target === 'string' && nodeIds.has(target)
    && isLabel(label);
}

function isViewport(value: unknown): boolean {
  if (!isObject(value) || !isPosition(value)) {
    return false;
  }

  const zoom = value['zoom'];
  return typeof zoom === 'number' && Number.isFinite(zoom) && zoom > 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

function isPosition(value: unknown): boolean {
  return isObject(value) && Number.isFinite(value['x']) && Number.isFinite(value['y']);
}

function isLabel(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string' || typeof value === 'number';
}
