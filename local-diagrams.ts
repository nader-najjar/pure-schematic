import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import type { RequestListener } from 'node:http';
import { text } from 'node:stream/consumers';
import { isDiagram, isDiagramName } from './validate-diagram.ts';

class FileError extends Error {
  public readonly status: number;
  public constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function exists(file: URL): Promise<boolean> {
  try {
    if (!(await lstat(file)).isFile()) throw new FileError(400, 'Choose a regular JSON file, not a folder or symlink.');
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function diagramNames(directory: URL): Promise<string[]> {
  if (!(await lstat(directory)).isDirectory()) throw new Error('The diagrams folder must be a regular directory.');
  return (await readdir(directory)).filter(isDiagramName).sort();
}

export async function readDiagram(file: URL): Promise<string> {
  if (!await exists(file)) throw new FileError(404, 'Diagram not found. Choose a file or use New.');
  const value: unknown = JSON.parse(await readFile(file, 'utf8'));
  if (!isDiagram(value)) throw new FileError(400, 'Invalid diagram JSON. Fix the file before opening or saving it.');
  return JSON.stringify(value);
}

export function localDiagrams(directory: URL): RequestListener {
  let pending = Promise.resolve();
  return (request, response): void => {
    const origin = `http://${request.headers.host ?? ''}`;
    const isLocal = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+$/u.test(origin);
    if (!isLocal || (request.method !== 'GET' && request.method !== 'PUT')
      || (request.method === 'PUT' && (request.headers.origin !== origin
        || request.headers['content-type'] !== 'application/json'))) {
      response.writeHead(403).end('Files are available only from the local editor.');
      return;
    }

    async function handle(): Promise<void> {
      const names = await diagramNames(directory);
      const name = new URL(request.url ?? '/', origin).searchParams.get('name');
      response.setHeader('Cache-Control', 'no-store');
      if (request.method === 'GET' && name === null) {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify(names));
        return;
      }
      if (name === null || !isDiagramName(name)) {
        throw new FileError(400, 'Use a filename such as my-diagram.json inside the diagrams folder.');
      }
      const file = new URL(name, directory);
      if (request.method === 'GET') {
        const document = await readDiagram(file);
        response.setHeader('Content-Type', 'application/json');
        response.end(document);
        return;
      }
      const diagram: unknown = JSON.parse(await text(request));
      if (!isDiagram(diagram)) throw new FileError(400, 'Invalid diagram JSON. The saved file was not changed.');
      const isNew = request.headers['if-none-match'] === '*';
      const present = await exists(file);
      if (isNew && present) throw new FileError(409, 'That file already exists. Choose another name or open it.');
      if (!isNew) {
        const current = await readDiagram(file);
        const revision = '"' + createHash('sha256').update(current).digest('hex') + '"';
        if (request.headers['if-match'] !== revision) {
          throw new FileError(409, 'The file changed. Keep this tab open and compare with a freshly opened copy.');
        }
      }
      const temporary = new URL(`${name}.${randomUUID()}.tmp`, directory);
      try {
        await writeFile(temporary, JSON.stringify(diagram, null, 2) + '\n', { flag: 'wx' });
        // Linking a new file fails if another writer has already created that name.
        if (isNew) await link(temporary, file);
        else await rename(temporary, file);
      } finally {
        await rm(temporary, { force: true });
      }
      response.end(`Saved to diagrams/${name}`);
    }

    pending = pending.then(handle).catch((error: unknown): void => {
      const status = error instanceof FileError ? error.status : error instanceof SyntaxError ? 400 : 500;
      const message = error instanceof Error ? error.message : 'Check file permissions and try again.';
      response.writeHead(status).end(`Could not complete the file operation. ${message}`);
    });
  };
}
