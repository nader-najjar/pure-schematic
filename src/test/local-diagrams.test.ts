// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import type * as FileSystem from 'node:fs/promises';
import { createServer, request } from 'node:http';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localDiagrams } from '../../local-diagrams.ts';
import example from './fixtures/diagram.json';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FileSystem>();
  return { ...actual, rename: vi.fn(actual.rename) };
});

describe('local diagram save', () => {
  let server: Server;
  let directory: string;
  let file: URL;
  let origin: string;
  const original = JSON.stringify(example);

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'schematic-save-'));
    file = pathToFileURL(path.join(directory, 'example.json'));
    await writeFile(file, original);
    server = createServer(localDiagrams(pathToFileURL(directory + '/')));
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('Expected a listening server');
    origin = `http://127.0.0.1:${String(address.port)}`;
  });

  afterEach(async () => {
    await server[Symbol.asyncDispose]();
    await rm(directory, { recursive: true, force: true });
  });

  function save(body: string, requestOrigin = origin, contentType = 'application/json'): Promise<Response> {
    return fetch(origin + '?name=example.json', {
      method: 'PUT',
      headers: {
        'Origin': requestOrigin,
        'Content-Type': contentType,
        'If-Match': '"' + createHash('sha256').update(original).digest('hex') + '"'
      },
      body
    });
  }

  it('writes moved nodes and metadata to the fixed project file as readable native JSON', async () => {
    const diagram = {
      ...example,
      nodes: example.nodes.map((node) => ({ ...node, position: { x: 42, y: 84 } })),
      metadata: { owner: 'human' }
    };
    const response = await save(JSON.stringify(diagram));
    expect(response.status).toBe(200);
    expect(await readFile(file, 'utf8')).toBe(JSON.stringify(diagram, null, 2) + '\n');
    expect(await readdir(directory)).toEqual(['example.json']);
  });

  it.each(['not JSON', '{}', '{"nodes":[null],"edges":[],"viewport":{}}',
    JSON.stringify({ nodes: [{ id: 1, position: null }], edges: [], viewport: [] }),
    JSON.stringify({ ...example, nodes: [...example.nodes, ...example.nodes] }),
    JSON.stringify({ ...example, edges: [{ id: 'bad', source: 'idea', target: 'missing' }] }),
    JSON.stringify({ ...example, viewport: { x: 0, y: 0, zoom: 0 } }),
    JSON.stringify({
      ...example, nodes: [{ id: 'x', position: { x: 0, y: 0 }, data: {}, type: 'unsupported' }], edges: []
    }),
    JSON.stringify({ ...example, nodes: [{ id: 'x', position: { x: 0, y: 0 }, data: { label: {} } }], edges: [] })])(
    'rejects bad input without replacing the saved diagram: %s',
    async (body) => {
      const response = await save(body);
      expect(response.status).toBe(400);
      expect(await readFile(file, 'utf8')).toBe(original);
    }
  );

  it('rejects another origin, a missing origin, and form submissions without writing', async () => {
    for (const [requestOrigin, contentType] of [
      ['https://example.invalid', 'application/json'],
      ['', 'application/json'],
      [origin, 'text/plain']
    ]) {
      const response = await save(original, requestOrigin, contentType);
      expect(response.status).toBe(403);
      expect(await readFile(file, 'utf8')).toBe(original);
    }
  });

  it('refuses stale saves and preserves newer disk changes', async () => {
    const newer = JSON.stringify({ ...example, metadata: 'changed outside the browser' });
    await writeFile(file, newer);
    const response = await save(original);
    expect(response.status).toBe(409);
    expect(await readFile(file, 'utf8')).toBe(newer);
  });

  it('allows only one of two saves based on the same revision', async () => {
    const first = JSON.stringify({ ...example, metadata: 'first tab' });
    const second = JSON.stringify({ ...example, metadata: 'second tab' });
    const results = await Promise.all([save(first), save(second)]);
    expect(results.map((response) => response.status).toSorted((a, b) => a - b)).toEqual([200, 409]);
  });

  it('rejects requests that do not use the save method', async () => {
    const response = await fetch(origin, { method: 'PATCH', headers: { Origin: origin } });
    expect(response.status).toBe(403);
    expect(await readFile(file, 'utf8')).toBe(original);
  });

  it('preserves the original and removes the temporary file when replacement fails', async () => {
    vi.mocked(rename).mockRejectedValueOnce(new Error('File replacement failed'));
    const response = await save(JSON.stringify({ ...example, metadata: 'new content' }));
    expect(response.status).toBe(500);
    expect(await readFile(file, 'utf8')).toBe(original);
    expect(await readdir(directory)).toEqual(['example.json']);
    const retry = await save(original);
    expect(retry.status).toBe(200);
  });

  it('creates a new diagram exclusively and opens its native JSON', async () => {
    const url = origin + '?name=new.json';
    const options = {
      method: 'PUT', body: original,
      headers: { 'Origin': origin, 'Content-Type': 'application/json', 'If-None-Match': '*' }
    };
    const created = await fetch(url, options);
    expect(created.status).toBe(200);
    const opened = await fetch(url);
    expect(await opened.json()).toEqual(example);
    const duplicate = await fetch(url, options);
    expect(duplicate.status).toBe(409);
    const listing = await fetch(origin);
    expect(await listing.json()).toEqual(['example.json', 'new.json']);
  });

  it.each(['../outside.json', '/outside.json', 'bad.txt', 'bad name.json'])(
    'rejects paths outside the supported project filenames: %s', async (name) => {
      const response = await fetch(origin + '?name=' + encodeURIComponent(name));
      expect(response.status).toBe(400);
    }
  );

  it('refuses symlink files and forged local hosts', async () => {
    await symlink(file, new URL('linked.json', file));
    const linked = await fetch(origin + '?name=linked.json');
    expect(linked.status).toBe(400);
    const forged = await new Promise<number>((resolve, reject) => {
      const call = request(origin, { headers: { Host: 'example.invalid' } }, (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      });
      call.on('error', reject);
      call.end();
    });
    expect(forged).toBe(403);
    expect(await readFile(file, 'utf8')).toBe(original);
  });

  it('preserves the file after an interrupted upload and permits retry', async () => {
    const arrived = once(server, 'request');
    const interrupted = request(origin + '?name=example.json', {
      method: 'PUT',
      headers: { 'Origin': origin, 'Content-Type': 'application/json', 'Content-Length': 1000 }
    });
    interrupted.on('error', () => { /* Disconnect is intentional. */ });
    interrupted.write('{"nodes":');
    await arrived;
    interrupted.destroy();
    expect(await readFile(file, 'utf8')).toBe(original);
    const retried = await save(original);
    expect(retried.status).toBe(200);
    expect(await readdir(directory)).toEqual(['example.json']);
  });

  it.each(['missing', 'child'])('rejects a missing or self parent: %s', async (parentId) => {
    const invalid = { ...example, nodes: [{ id: 'child', parentId, position: { x: 0, y: 0 }, data: {} }], edges: [] };
    const response = await save(JSON.stringify(invalid));
    expect(response.status).toBe(400);
    expect(await readFile(file, 'utf8')).toBe(original);
  });

  it('preserves native groups and numeric labels, while rejecting child-first ordering', async () => {
    const nodes = [
      { id: 'group', type: 'group', position: { x: 0, y: 0 }, data: {} },
      { id: 'child', parentId: 'group', position: { x: 10, y: 10 }, data: { label: 42 } }
    ];
    const invalid = await save(JSON.stringify({ ...example, nodes: nodes.toReversed(), edges: [] }));
    expect(invalid.status).toBe(400);
    const valid = await save(JSON.stringify({ ...example, nodes, edges: [] }));
    expect(valid.status).toBe(200);
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ nodes });
  });

  it('reports an unreadable target without removing existing contents', async () => {
    await rm(file);
    await mkdir(file);
    const kept = new URL('kept.json', file.href + '/');
    await writeFile(kept, original);
    const response = await save(original);
    expect(response.status).toBe(400);
    expect(await readFile(kept, 'utf8')).toBe(original);
    expect(await readdir(directory)).toEqual(['example.json']);
  });
});
