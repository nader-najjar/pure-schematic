import type { ReactFlowJsonObject } from '@xyflow/react';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPosition(value: unknown): boolean {
  return isObject(value) && Number.isFinite(value['x']) && Number.isFinite(value['y']);
}

function isLabel(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string' || typeof value === 'number';
}

function supportedType(value: unknown, types: string[]): boolean {
  return value === undefined || (typeof value === 'string' && types.includes(value));
}

// Validate the native fields needed to reopen a diagram; retain all additional metadata.
export function isDiagram(value: unknown): value is ReactFlowJsonObject {
  if (!isObject(value)) return false;
  const { nodes, edges, viewport } = value;
  if (!Array.isArray(nodes) || !Array.isArray(edges) || !isPosition(viewport)
    || !isObject(viewport) || typeof viewport['zoom'] !== 'number' || viewport['zoom'] <= 0
    || !Number.isFinite(viewport['zoom'])) return false;

  const nodeIds = new Set<string>();
  for (const node of nodes as unknown[]) {
    if (!isObject(node) || typeof node['id'] !== 'string' || node['id'] === ''
      || nodeIds.has(node['id']) || !isPosition(node['position']) || !isObject(node['data'])
      || !isLabel(node['data']['label'])
      || !supportedType(node['type'], ['default', 'input', 'output', 'group'])) return false;
    if (node['parentId'] !== undefined
      && (typeof node['parentId'] !== 'string' || !nodeIds.has(node['parentId']))) return false;
    nodeIds.add(node['id']);
  }
  const edgeIds = new Set<string>();
  for (const edge of edges as unknown[]) {
    if (!isObject(edge) || typeof edge['id'] !== 'string' || edge['id'] === '' || edgeIds.has(edge['id'])
      || typeof edge['source'] !== 'string' || !nodeIds.has(edge['source'])
      || typeof edge['target'] !== 'string' || !nodeIds.has(edge['target']) || !isLabel(edge['label'])
      || !supportedType(edge['type'], ['default', 'straight', 'step', 'smoothstep', 'simplebezier'])) return false;
    edgeIds.add(edge['id']);
  }
  return true;
}

export function isDiagramName(name: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.json$/u.test(name);
}
