import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDiagram } from '../shared/utilities/DiagramValidatorUtility.ts';

export class DiagramFileError extends Error {
  public readonly reason: 'invalid' | 'missing' | 'conflict';

  public constructor(reason: 'invalid' | 'missing' | 'conflict', message: string) {
    super(message);
    this.reason = reason;
  }
}

export class DiagramFileStore {
  private readonly directory: URL;
  private pendingSave = Promise.resolve();

  public constructor(directory: URL) {
    this.directory = directory;
  }

  public async list(): Promise<string[]> {
    await this.checkDirectory();
    const entries = await readdir(this.directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name)
      .toSorted((left, right) => left.localeCompare(right));
  }

  public async read(name: string): Promise<string> {
    await this.checkDirectory();
    const file = this.fileUrl(name);
    if (!await this.fileExists(file)) {
      throw new DiagramFileError('missing', 'Diagram not found. Choose a file or use New.');
    }

    const document: unknown = JSON.parse(await readFile(file, 'utf8'));
    if (!isDiagram(document)) {
      throw new DiagramFileError('invalid', 'Invalid diagram JSON. Fix the file before opening it.');
    }
    return JSON.stringify(document);
  }

  // An absent revision means create a new file; updates must match the last opened version.
  public async save(name: string, document: string, expectedRevision?: string): Promise<void> {
    const value: unknown = JSON.parse(document);
    if (!isDiagram(value)) {
      throw new DiagramFileError('invalid', 'Invalid diagram JSON. The saved file was not changed.');
    }
    const contents = JSON.stringify(value, null, 2) + '\n';

    // Serialize saves so two tabs cannot both replace the same revision.
    const previousSave = this.pendingSave;
    const nextSave = Promise.withResolvers<undefined>();
    this.pendingSave = nextSave.promise;
    await previousSave;
    try {
      await this.write(name, contents, expectedRevision);
    } finally {
      nextSave.resolve(undefined);
    }
  }

  private async write(name: string, contents: string, expectedRevision: string | undefined): Promise<void> {
    await this.checkDirectory();
    const file = this.fileUrl(name);
    const exists = await this.fileExists(file);
    if (expectedRevision === undefined && exists) {
      throw new DiagramFileError('conflict', 'That file already exists. Choose another name or open it.');
    }
    if (expectedRevision !== undefined) {
      const current = await this.read(name);
      const revision = '"' + createHash('sha256').update(current).digest('hex') + '"';
      if (expectedRevision !== revision) {
        throw new DiagramFileError(
          'conflict',
          'The file changed. Keep this tab open and compare with a freshly opened copy.'
        );
      }
    }

    const temporary = new URL(`${randomUUID()}.tmp`, this.directory);
    try {
      await writeFile(temporary, contents, { flag: 'wx' });
      if (expectedRevision === undefined) {
        // Exclusive creation prevents replacing a file created by another writer.
        await link(temporary, file);
      } else {
        await rename(temporary, file);
      }
    } catch (error) {
      if (hasCode(error, 'EEXIST')) {
        throw new DiagramFileError('conflict', 'That file already exists. Choose another name or open it.');
      }
      throw error;
    } finally {
      await rm(temporary, { force: true });
    }
  }

  private fileUrl(name: string): URL {
    if (!name.endsWith('.json') || /[/\\]/u.test(name) || name.includes('\0')) {
      throw new DiagramFileError('invalid', 'Choose a JSON filename inside the diagrams folder, without a path.');
    }
    return new URL(encodeURIComponent(name), this.directory);
  }

  private async checkDirectory(): Promise<void> {
    const info = await lstat(path.resolve(fileURLToPath(this.directory)));
    if (!info.isDirectory()) {
      throw new DiagramFileError('invalid', 'The diagrams folder must be a regular directory.');
    }
  }

  private async fileExists(file: URL): Promise<boolean> {
    try {
      const info = await lstat(file);
      if (!info.isFile()) {
        throw new DiagramFileError('invalid', 'Choose a regular JSON file, not a folder or symlink.');
      }
      return true;
    } catch (error) {
      if (hasCode(error, 'ENOENT')) {
        return false;
      }
      throw error;
    }
  }
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}
