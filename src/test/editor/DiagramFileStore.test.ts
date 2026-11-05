// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import type * as FileSystem from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import type { ViteDevServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { diagramPlugin } from '../../main/composition/DiagramPlugin.ts';
import { DiagramFileStore } from '../../main/editor/DiagramFileStore.ts';
import example from '../fixtures/diagram.json';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FileSystem>();
  return { ...actual, rename: vi.fn(actual.rename) };
});

function revision(document: string): string {
  return '"' + createHash('sha256').update(document).digest('hex') + '"';
}

describe('diagram persistence', () => {
  let directory: URL;
  let files: DiagramFileStore;
  let server: ViteDevServer | undefined;
  const original = JSON.stringify(example);

  beforeEach(async () => {
    const temporary = await mkdtemp(path.join(tmpdir(), 'schematic-store-'));
    directory = pathToFileURL(temporary + '/');
    files = new DiagramFileStore(directory);
    await writeFile(new URL('example.json', directory), original);
  });

  afterEach(async () => {
    await server?.close();
    server = undefined;
    await rm(directory, { recursive: true, force: true });
  });

  async function savedContents(): Promise<string> {
    return readFile(new URL('example.json', directory), 'utf8');
  }

  describe('DiagramFileStore', () => {
    it('lists, creates and reopens native documents with metadata and ordinary filenames', async () => {
      const document = { ...example, metadata: { owner: 'human' } };
      const name = 'Service map #1%.json';
      await files.save(name, JSON.stringify(document));

      expect(await files.list()).toEqual(['example.json', name]);
      expect(JSON.parse(await files.read(name))).toEqual(document);
      const file = new URL(encodeURIComponent(name), directory);
      expect(await readFile(file, 'utf8')).toBe(JSON.stringify(document, null, 2) + '\n');
    });

    it('updates a matching revision without leaving temporary files', async () => {
      const document = JSON.stringify({ ...example, metadata: 'changed' });
      await files.save('example.json', document, revision(original));

      expect(await files.read('example.json')).toBe(document);
      expect(await readdir(directory)).toEqual(['example.json']);
    });

    it('refuses stale saves and exclusive creation over an existing file', async () => {
      await expect(files.save('example.json', original, 'stale')).rejects.toMatchObject({ reason: 'conflict' });
      await expect(files.save('example.json', original)).rejects.toMatchObject({ reason: 'conflict' });
      expect(await savedContents()).toBe(original);
    });

    it('allows only one competing update and remains usable after the conflict', async () => {
      const first = JSON.stringify({ ...example, metadata: 'first' });
      const second = JSON.stringify({ ...example, metadata: 'second' });
      const results = await Promise.allSettled([
        files.save('example.json', first, revision(original)),
        files.save('example.json', second, revision(original))
      ]);

      expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
      expect(await files.read('example.json')).toBe(first);
      await files.save('example.json', second, revision(first));
      expect(await files.read('example.json')).toBe(second);
    });

    it('preserves the original on write failure, cleans up and permits retry', async () => {
      vi.mocked(rename).mockRejectedValueOnce(new Error('Disk write failed'));
      await expect(files.save('example.json', original, revision(original))).rejects.toThrow('Disk write failed');

      expect(await savedContents()).toBe(original);
      expect(await readdir(directory)).toEqual(['example.json']);
      await files.save('example.json', original, revision(original));
    });

    it.each([
      '../outside.json', '/outside.json', 'nested/file.json', String.raw`nested\file.json`, 'file.txt', 'bad\0.json'
    ])(
      'rejects a filename that is not a direct JSON child: %s', async (name) => {
        await expect(files.read(name)).rejects.toMatchObject({ reason: 'invalid' });
        await expect(files.save(name, original)).rejects.toMatchObject({ reason: 'invalid' });
        expect(await savedContents()).toBe(original);
      }
    );

    it.each(['{', '{}', JSON.stringify({ ...example, edges: [{ id: 'bad', source: 'idea', target: 'missing' }] })])(
      'rejects invalid content without writing: %s', async (document) => {
        await expect(files.save('example.json', document, revision(original))).rejects.toThrow();
        expect(await savedContents()).toBe(original);
        await writeFile(new URL('broken.json', directory), document);
        await expect(files.read('broken.json')).rejects.toThrow();
      }
    );

    it('reports missing files without recreating deleted documents', async () => {
      await expect(files.read('missing.json')).rejects.toMatchObject({ reason: 'missing' });
      const save = files.save('missing.json', original, revision(original));
      await expect(save).rejects.toMatchObject({ reason: 'missing' });
      expect(await readdir(directory)).toEqual(['example.json']);
    });

    it('refuses symlink files and directories', async () => {
      await symlink(new URL('example.json', directory), new URL('linked.json', directory));
      await expect(files.read('linked.json')).rejects.toMatchObject({ reason: 'invalid' });
      await expect(files.save('linked.json', original)).rejects.toMatchObject({ reason: 'invalid' });
      expect(await files.list()).toEqual(['example.json']);

      const link = new URL('linked-directory', directory);
      await symlink(directory, link);
      await expect(new DiagramFileStore(new URL(link.href + '/')).list()).rejects.toThrow();
    });
  });

  async function startEditorServer(): Promise<string> {
    server = await createServer({
      configFile: false,
      root: fileURLToPath(directory),
      plugins: [diagramPlugin(directory, 'serve')],
      server: { host: '127.0.0.1', port: 0, watch: null },
      logLevel: 'silent'
    });
    await server.listen();
    const address = server.httpServer?.address();
    if (address === undefined || address === null || typeof address === 'string') {
      throw new Error('Expected a listening editor server.');
    }
    return `http://127.0.0.1:${String(address.port)}`;
  }

  describe('Vite file endpoint', () => {
    it('connects list, open, create, update and stale-save responses to the file store', async () => {
      const origin = await startEditorServer();
      const endpoint = origin + '/__schematic/diagrams';
      const listed = await fetch(endpoint);
      const opened = await fetch(endpoint + '?name=example.json');
      expect(await listed.json()).toEqual(['example.json']);
      expect(await opened.json()).toEqual(example);

      const headers = { 'Origin': origin, 'Content-Type': 'application/json', 'If-None-Match': '*' };
      const created = await fetch(endpoint + '?name=new.json', { method: 'PUT', headers, body: original });
      expect(created.status).toBe(200);

      const changed = JSON.stringify({ ...example, metadata: 'changed' });
      const update = {
        method: 'PUT',
        headers: { 'Origin': origin, 'Content-Type': 'application/json', 'If-Match': revision(original) },
        body: changed
      };
      const saved = await fetch(endpoint + '?name=example.json', update);
      const stale = await fetch(endpoint + '?name=example.json', update);
      expect(saved.status).toBe(200);
      expect(stale.status).toBe(409);
      expect(await files.read('example.json')).toBe(changed);
    });

    it('rejects cross-origin writes and missing save preconditions', async () => {
      const origin = await startEditorServer();
      const endpoint = origin + '/__schematic/diagrams?name=example.json';
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Origin': 'https://example.invalid', 'Content-Type': 'application/json' },
        body: original
      });
      expect(response.status).toBe(403);

      const missingRevision = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Origin': origin, 'Content-Type': 'application/json' },
        body: original
      });
      expect(missingRevision.status).toBe(428);
      expect(await savedContents()).toBe(original);
    });
  });
});
