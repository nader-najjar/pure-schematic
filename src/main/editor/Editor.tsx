import { Panel, useEdges, useNodes, useReactFlow, useViewport } from '@xyflow/react';
import type { ReactFlowJsonObject } from '@xyflow/react';
import { useEffect, useState } from 'react';
import type { ChangeEvent, ReactElement, SubmitEvent } from 'react';
import { isDiagram } from '../shared/utilities/DiagramValidatorUtility.ts';
import { EditControls } from './EditControls.tsx';
import './Editor.css';

export interface OpenDiagram {
  readonly name: string;
  readonly diagram: ReactFlowJsonObject;
  readonly isNew: boolean;
}

interface EditorProps {
  readonly opened: OpenDiagram;
  readonly onOpen: (next: OpenDiagram) => void;
}

const DIAGRAM_ENDPOINT = '/__schematic/diagrams';

export function Editor({ opened, onOpen }: EditorProps): ReactElement {
  const nodes = useNodes();
  const edges = useEdges();
  const viewport = useViewport();
  const { toObject } = useReactFlow();
  const document = serializeDiagram({ ...opened.diagram, nodes, edges, viewport });
  const [savedDocument, setSavedDocument] = useState(() => serializeDiagram(opened.diagram));
  const [revisionSource, setRevisionSource] = useState(() => JSON.stringify(opened.diagram));
  const [isNew, setIsNew] = useState(opened.isNew);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [name, setName] = useState(opened.name);
  const [savedFileName, setSavedFileName] = useState(opened.name);
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const isDirty = isNew || document !== savedDocument;

  function reportError(error: unknown): void {
    setErrorMessage(error instanceof Error ? error.message : 'Could not complete the operation. Please try again.');
  }

  useEffect(() => {
    let active = true;

    async function loadFileNames(): Promise<void> {
      const response = await fetch(DIAGRAM_ENDPOINT);
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const names: unknown = await response.json();
      if (Array.isArray(names) && names.every((value: unknown) => typeof value === 'string')) {
        if (active) {
          setAvailableFiles(names);
        }
        return;
      }
      throw new Error('Could not read the diagram list. Reload and try again.');
    }

    void loadFileNames().catch((error: unknown): void => {
      if (active) {
        reportError(error);
      }
    });

    return (): void => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    function warnBeforeLeaving(event: BeforeUnloadEvent): void {
      event.preventDefault();
    }

    window.addEventListener('beforeunload', warnBeforeLeaving);
    return (): void => {
      window.removeEventListener('beforeunload', warnBeforeLeaving);
    };
  }, [isDirty]);

  function replaceDiagram(next: OpenDiagram): void {
    const current = serializeDiagram({ ...opened.diagram, ...toObject() });
    const hasUnsavedChanges = isNew || current !== savedDocument;
    if (hasUnsavedChanges && !confirm('Discard unsaved changes and open another diagram?')) {
      return;
    }

    onOpen(next);
  }

  function createDiagram(): void {
    setErrorMessage('');
    if (availableFiles.includes(name)) {
      setErrorMessage('That file already exists. Choose a new filename.');
      return;
    }

    replaceDiagram({
      name,
      isNew: true,
      diagram: {
        nodes: [],
        edges: [],
        viewport: { x: 40, y: 40, zoom: 1 }
      }
    });
  }

  async function openDiagram(): Promise<void> {
    setErrorMessage('');
    setIsBusy(true);
    try {
      const response = await fetch(`${DIAGRAM_ENDPOINT}?name=${encodeURIComponent(name)}`);
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const diagram: unknown = await response.json();
      if (!isDiagram(diagram)) {
        throw new Error('Invalid diagram JSON. The current diagram is unchanged.');
      }

      replaceDiagram({ name, diagram, isNew: false });
    } catch (error) {
      reportError(error);
    } finally {
      setIsBusy(false);
    }
  }

  async function saveDiagram(): Promise<void> {
    setErrorMessage('');
    const target = isNew ? name : savedFileName;
    setIsBusy(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (isNew) {
        headers['If-None-Match'] = '*';
      } else {
        headers['If-Match'] = await documentRevision(revisionSource);
      }

      const response = await fetch(`${DIAGRAM_ENDPOINT}?name=${encodeURIComponent(target)}`, {
        method: 'PUT',
        headers,
        body: document
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }

      setSavedDocument(document);
      setRevisionSource(document);
      setIsNew(false);
      setSavedFileName(target);
      setAvailableFiles((current) => [...new Set([...current, target])]);
    } catch (error) {
      reportError(error);
    } finally {
      setIsBusy(false);
    }
  }

  function handleOpen(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    void openDiagram();
  }

  function handleSave(): void {
    void saveDiagram();
  }

  function handleNameChange(event: ChangeEvent<HTMLInputElement>): void {
    setName(event.target.value);
  }

  let message = isDirty ? 'Unsaved changes' : `Saved to src/main/diagrams/${savedFileName}`;
  if (errorMessage !== '') {
    message = errorMessage;
  }
  if (isBusy) {
    message = 'Working…';
  }

  return (
    <Panel position="top-right" className="editor-panel">
      <fieldset disabled={isBusy}>
        <legend>
          Local editor · src/main/diagrams/
          {isNew ? name : savedFileName}
        </legend>
        <form onSubmit={handleOpen}>
          <label>
            Diagram file
            <input list="diagram-files" value={name} onChange={handleNameChange} />
          </label>
          <datalist id="diagram-files">
            {availableFiles.map((file) => <option key={file} value={file} />)}
          </datalist>
          <button type="submit">Open</button>
          <button type="button" onClick={createDiagram}>New</button>
          <button type="button" onClick={handleSave}>Save</button>
        </form>
        <EditControls />
      </fieldset>
      <p role="status">{message}</p>
    </Panel>
  );
}

// Keep native document fields while omitting temporary editor state.
function serializeDiagram(diagram: ReactFlowJsonObject): string {
  return JSON.stringify({
    ...diagram,
    nodes: diagram.nodes.map((node) => {
      const saved = { ...node };
      delete saved.selected;
      delete saved.dragging;
      delete saved.measured;
      delete saved.resizing;
      return saved;
    }),
    edges: diagram.edges.map((edge) => {
      const saved = { ...edge };
      delete saved.selected;
      return saved;
    })
  });
}

async function documentRevision(document: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(document));
  const hexadecimal = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return '"' + hexadecimal + '"';
}
