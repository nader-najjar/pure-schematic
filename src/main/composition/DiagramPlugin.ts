import { lstat, readdir, readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { text } from 'node:stream/consumers';
import type { Plugin } from 'vite';
import { DiagramFileError, DiagramFileStore } from '../editor/DiagramFileStore.ts';
import { isDiagram } from '../shared/utilities/DiagramValidatorUtility.ts';

export function diagramPlugin(directory: URL, command: 'build' | 'serve'): Plugin {
  return {
    name: 'local-diagrams',
    async buildStart(): Promise<void> {
      if (command !== 'build') {
        return;
      }

      await validateDiagrams(directory);
    },
    configureServer(server): void {
      const files = new DiagramFileStore(directory);
      server.middlewares.use('/__schematic/diagrams', (request, response) => {
        void handleRequest(files, request, response);
      });
    }
  };
}

async function validateDiagrams(directory: URL): Promise<void> {
  const directoryInfo = await lstat(directory);
  if (!directoryInfo.isDirectory()) {
    throw new Error('The diagrams folder must be a regular directory.');
  }

  const names = await readdir(directory);
  for (const name of names) {
    if (!name.endsWith('.json')) {
      continue;
    }

    try {
      const file = new URL(encodeURIComponent(name), directory);
      const fileInfo = await lstat(file);
      if (!fileInfo.isFile()) {
        throw new Error('Expected a regular JSON file.');
      }

      const value: unknown = JSON.parse(await readFile(file, 'utf8'));
      if (!isDiagram(value)) {
        throw new Error('Invalid diagram content.');
      }
    } catch (error) {
      throw new Error(`Invalid diagram: ${name}`, { cause: error });
    }
  }
}

async function handleRequest(
  files: DiagramFileStore,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    const origin = `http://${request.headers.host ?? ''}`;
    const isWrite = request.method === 'PUT';
    if (!isLocalEditorRequest(request, origin)) {
      response.writeHead(403).end('Files are available only from the local editor.');
      return;
    }

    const name = new URL(request.url ?? '/', origin).searchParams.get('name');
    response.setHeader('Cache-Control', 'no-store');
    if (!isWrite) {
      const document = name === null ? JSON.stringify(await files.list()) : await files.read(name);
      response.setHeader('Content-Type', 'application/json');
      response.end(document);
      return;
    }

    if (name === null) {
      throw new DiagramFileError('invalid', 'Choose a diagram filename before saving.');
    }
    const create = request.headers['if-none-match'] === '*';
    const revision = request.headers['if-match'];
    if ((!create && typeof revision !== 'string') || (create && revision !== undefined)) {
      response.writeHead(428).end('Open the current file before saving, or use New to create a diagram.');
      return;
    }

    const document = await text(request);
    await files.save(name, document, typeof revision === 'string' ? revision : undefined);
    response.end(`Saved ${name}`);
  } catch (error) {
    sendError(response, error);
  }
}

function isLocalEditorRequest(request: IncomingMessage, origin: string): boolean {
  const isLocal = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+$/u.test(origin);
  return isLocal && (request.method === 'GET'
    || (request.method === 'PUT'
      && request.headers.origin === origin
      && request.headers['content-type'] === 'application/json'));
}

function sendError(response: ServerResponse, error: unknown): void {
  let status = error instanceof SyntaxError ? 400 : 500;
  if (error instanceof DiagramFileError) {
    const statuses = { invalid: 400, missing: 404, conflict: 409 };
    status = statuses[error.reason];
  }
  const message = error instanceof Error ? error.message : 'Check file permissions and try again.';
  response.writeHead(status).end(`Could not complete the file operation. ${message}`);
}
