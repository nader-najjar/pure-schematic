import { Panel, useEdges, useNodes, useReactFlow, useViewport } from '@xyflow/react';
import type { ReactFlowJsonObject } from '@xyflow/react';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { isDiagram, isDiagramName } from '../../validate-diagram.ts';
import { diagramRevision, serializeDiagram } from './diagram.ts';
import { EditControls } from './EditControls.tsx';

export interface OpenDiagram {
  readonly name: string;
  readonly diagram: ReactFlowJsonObject;
  readonly isNew: boolean;
}

const endpoint = '/__schematic/diagrams';

export function Editor({ opened, onOpen }: {
  readonly opened: OpenDiagram;
  readonly onOpen: (next: OpenDiagram) => void;
}): ReactElement {
  const nodes = useNodes();
  const edges = useEdges();
  const viewport = useViewport();
  const { toObject } = useReactFlow();
  const document = serializeDiagram({ ...opened.diagram, nodes, edges, viewport });
  const [savedDocument, setSavedDocument] = useState(() => serializeDiagram(opened.diagram));
  const [revisionSource, setRevisionSource] = useState(() => JSON.stringify(opened.diagram));
  const [isNew, setIsNew] = useState(opened.isNew);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [name, setName] = useState(opened.name);
  const [fileName, setFileName] = useState(opened.name);
  const [files, setFiles] = useState<string[]>([]);
  const isDirty = isNew || document !== savedDocument;

  function report(error: unknown): void {
    setErrorMessage(error instanceof Error ? error.message : 'Could not complete the operation. Please try again.');
  }

  useEffect(() => {
    let active = true;
    async function list(): Promise<void> {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(await response.text());
      const names: unknown = await response.json();
      if (Array.isArray(names) && names.every((value: unknown) => typeof value === 'string')) {
        if (active) setFiles(names);
        return;
      }
      throw new Error('Could not read the diagram list. Reload and try again.');
    }
    void list().catch((error: unknown): void => {
      if (active) report(error);
    });
    return (): void => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isDirty) return;
    function warn(event: BeforeUnloadEvent): void {
      event.preventDefault();
    }
    window.addEventListener('beforeunload', warn);
    return (): void => {
      window.removeEventListener('beforeunload', warn);
    };
  }, [isDirty]);

  function replace(next: OpenDiagram): void {
    const current = serializeDiagram({ ...opened.diagram, ...toObject() });
    if ((isNew || current !== savedDocument)
      && !confirm('Discard unsaved changes and open another diagram?')) return;
    onOpen(next);
  }

  async function open(create: boolean): Promise<void> {
    setErrorMessage('');
    if (!isDiagramName(name)) {
      setErrorMessage('Use a filename such as my-diagram.json.');
      return;
    }
    if (create) {
      if (files.includes(name)) {
        setErrorMessage('That file already exists. Choose a new filename.');
        return;
      }
      replace({ name, isNew: true, diagram: { nodes: [], edges: [], viewport: { x: 40, y: 40, zoom: 1 } } });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${endpoint}?name=${encodeURIComponent(name)}`);
      if (!response.ok) throw new Error(await response.text());
      const diagram: unknown = await response.json();
      if (!isDiagram(diagram)) throw new Error('Invalid diagram JSON. The current diagram is unchanged.');
      replace({ name, diagram, isNew: false });
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }

  async function save(): Promise<void> {
    setErrorMessage('');
    const target = isNew ? name : fileName;
    if (!isDiagramName(target)) {
      setErrorMessage('Use a filename such as my-diagram.json.');
      return;
    }
    setBusy(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (isNew) headers['If-None-Match'] = '*';
      else headers['If-Match'] = await diagramRevision(revisionSource);
      const response = await fetch(`${endpoint}?name=${encodeURIComponent(target)}`, {
        method: 'PUT', headers, body: document
      });
      if (!response.ok) throw new Error(await response.text());
      setSavedDocument(document);
      setRevisionSource(document);
      setIsNew(false);
      setFileName(target);
      setFiles((current) => [...new Set([...current, target])]);
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }

  let message = isDirty ? 'Unsaved changes' : `Saved to diagrams/${fileName}`;
  if (errorMessage !== '') message = errorMessage;
  if (busy) message = 'Working…';

  return (
    <Panel position="top-right" className="editor-panel">
      <fieldset disabled={busy}>
        <legend>
          Local editor · diagrams/
          {isNew ? name : fileName}
        </legend>
        <form onSubmit={(event) => {
          event.preventDefault();
          void open(false);
        }}
        >
          <label>
            Diagram file
            <input list="diagram-files" value={name} onChange={(event) => { setName(event.target.value); }} />
          </label>
          <datalist id="diagram-files">{files.map((file) => <option key={file} value={file} />)}</datalist>
          <button type="submit">Open</button>
          <button type="button" onClick={() => { void open(true); }}>New</button>
          <button type="button" onClick={() => { void save(); }}>Save</button>
        </form>
        <EditControls />
      </fieldset>
      <p role="status">{message}</p>
    </Panel>
  );
}
