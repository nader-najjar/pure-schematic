import { expect, it } from 'vitest';
import { isDiagram } from '../../../main/shared/utilities/DiagramValidatorUtility.ts';
import example from '../../fixtures/diagram.json';

const invalidDiagrams: readonly (readonly [string, unknown])[] = [
  ['null document', null],
  ['missing document fields', {}],
  ['malformed node and viewport', { nodes: [null], edges: [], viewport: {} }],
  ['duplicate node IDs', { ...example, nodes: [...example.nodes, ...example.nodes] }],
  ['missing connection target', {
    ...example,
    edges: [{ id: 'bad', source: 'idea', target: 'missing' }]
  }],
  ['zero viewport zoom', { ...example, viewport: { x: 0, y: 0, zoom: 0 } }],
  ['object label', {
    ...example,
    nodes: [{ id: 'x', position: { x: 0, y: 0 }, data: { label: {} } }],
    edges: []
  }]
];

it.each(invalidDiagrams)('rejects %s', (_description, value) => {
  expect(isDiagram(value)).toBe(false);
});

it('accepts native content and metadata without changing them', () => {
  const value = { ...example, metadata: { owner: 'human' } };
  const before = structuredClone(value);

  expect(isDiagram(value)).toBe(true);
  expect(value).toEqual(before);
});

it('requires existing parents before their children', () => {
  const nodes = [
    { id: 'group', type: 'group', position: { x: 0, y: 0 }, data: {} },
    { id: 'child', parentId: 'group', position: { x: 10, y: 10 }, data: { label: 42 } }
  ];

  expect(isDiagram({ ...example, nodes, edges: [] })).toBe(true);
  expect(isDiagram({ ...example, nodes: nodes.toReversed(), edges: [] })).toBe(false);
  expect(isDiagram({ ...example, nodes: [nodes[1]], edges: [] })).toBe(false);
});
