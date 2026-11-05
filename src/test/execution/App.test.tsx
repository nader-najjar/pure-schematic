import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import type { ReactElement } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../main/execution/App.tsx';
import example from '../fixtures/diagram.json';

vi.mock('../../main/diagrams/example.json', async () => import('../fixtures/diagram.json'));

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    public observe(): void {
      // Layout is verified in the browser.
    }

    public unobserve(): void {
      // No layout observer in jsdom.
    }

    public disconnect(): void {
      // No layout observer in jsdom.
    }
  });
});
afterEach(cleanup);

function mockDiagramRequests(save = vi.fn<typeof fetch>().mockResolvedValue(new Response('Saved'))): typeof save {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockImplementation((input, options) => {
    if (options?.method === 'PUT') {
      return save(input, options);
    }

    const value = (typeof input === 'string' && input.includes('?name=')) ? example : ['example.json', 'other.json'];
    return Promise.resolve(Response.json(value));
  }));
  return save;
}

async function waitForFileList(): Promise<void> {
  await waitFor(() => {
    expect(document.querySelector('option[value="example.json"]')).not.toBeNull();
  });
}

function MoveNode(): ReactElement {
  const { setNodes } = useReactFlow();

  function moveNodes(): void {
    setNodes((nodes) => nodes.map((node) => ({
      ...node,
      position: { ...node.position, x: node.position.x + 10 }
    })));
  }

  return <button onClick={moveNodes}>Move nodes</button>;
}

function SelectNumberedNode(): ReactElement {
  const { updateNode } = useReactFlow();

  function selectNumberedNode(): void {
    updateNode('idea', { selected: true, data: { label: 42 } });
  }

  return <button onClick={selectNumberedNode}>Select number</button>;
}

describe('local editor', () => {
  // These component tests mock the endpoint; DiagramFileStore has separate filesystem tests.
  it('loads the diagram and sends native JSON to its selected file endpoint', async () => {
    const request = mockDiagramRequests();
    render(<App />);
    await waitForFileList();
    expect(screen.getByText('Shape the idea')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Fit View' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(request).toHaveBeenCalledOnce();
    });
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('Saved to src/main/diagrams/example.json');
    });
    const [url, options] = request.mock.calls[0] ?? [];
    expect(url).toBe('/__schematic/diagrams?name=example.json');
    if (typeof options?.body !== 'string') {
      throw new TypeError('Expected a JSON request body');
    }

    const saved: unknown = JSON.parse(options.body);
    expect(saved).toMatchObject(example);
  });

  it('adds, renames, cancels a label edit, and deletes using native node operations', async () => {
    mockDiagramRequests();
    render(<App />);
    await waitForFileList();
    fireEvent.click(screen.getByRole('button', { name: 'Add node' }));
    const label = await screen.findByRole('textbox', { name: 'Label' });
    fireEvent.change(label, { target: { value: 'Human decision' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply label' }));
    expect(await screen.findByText('Human decision')).toBeDefined();
    fireEvent.change(label, { target: { value: 'Canceled edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Canceled edit')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));
    await waitFor(() => {
      expect(screen.queryByText('Human decision')).toBeNull();
    });
  });

  it('creates a blank diagram and saves it as a new file without replacing another', async () => {
    const request = mockDiagramRequests();
    render(<App />);
    await waitForFileList();
    fireEvent.change(screen.getByRole('combobox', { name: 'Diagram file' }), { target: { value: 'new.json' } });
    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(screen.queryByText('Shape the idea')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Unsaved changes');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('Saved to src/main/diagrams/new.json');
    });
    expect(request.mock.calls[0]?.[1]?.headers).toMatchObject({ 'If-None-Match': '*' });
  });

  it('opens another file and confirms before discarding unsaved work', async () => {
    mockDiagramRequests();
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal('confirm', confirm);
    render(<App />);
    await waitForFileList();
    fireEvent.click(screen.getByRole('button', { name: 'Add node' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Diagram file' }), { target: { value: 'other.json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => {
      expect(confirm).toHaveBeenCalledOnce();
    });
    expect(screen.getByText('New node')).toBeDefined();
    confirm.mockReturnValue(true);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open' }).closest('fieldset')?.disabled).toBe(false);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('Saved to src/main/diagrams/other.json');
    });
    expect(screen.queryByText('New node')).toBeNull();
  });

  it('rejects an existing new filename', async () => {
    mockDiagramRequests();
    render(<App />);
    await waitForFileList();
    fireEvent.change(screen.getByRole('combobox', { name: 'Diagram file' }), { target: { value: 'example.json' } });
    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(screen.getByText('Shape the idea')).toBeDefined();
    expect(screen.getByRole('status').textContent).toMatch(/filename/u);
  });

  it.each([new Error('Please try again.'), 'offline'])('keeps edits when a save fails: %s', async (error) => {
    mockDiagramRequests(vi.fn<typeof fetch>().mockRejectedValue(error));
    render(<App />);
    await waitForFileList();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('try again');
    });
    expect(screen.getByText('Shape the idea')).toBeDefined();
  });

  it('shows a server conflict without claiming success', async () => {
    mockDiagramRequests(vi.fn<typeof fetch>().mockResolvedValue(new Response('File changed', { status: 409 })));
    render(<App />);
    await waitForFileList();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('File changed');
    });
  });

  it('keeps edits made during saving dirty and warns before leaving', async () => {
    const pending = Promise.withResolvers<Response>();
    mockDiagramRequests(vi.fn<typeof fetch>().mockReturnValue(pending.promise));
    render(
      <ReactFlowProvider>
        <App />
        <MoveNode />
      </ReactFlowProvider>
    );
    await waitForFileList();
    fireEvent.click(screen.getByRole('button', { name: 'Move nodes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move nodes' }));
    await act(async () => {
      pending.resolve(new Response('Saved'));
      await pending.promise;
    });
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('Unsaved changes');
    });
    const leaving = new Event('beforeunload', { cancelable: true });
    dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);
  });

  it('shows numeric labels and preserves them when Apply makes no change', async () => {
    const request = mockDiagramRequests();
    render(
      <ReactFlowProvider>
        <App />
        <SelectNumberedNode />
      </ReactFlowProvider>
    );
    await waitForFileList();
    fireEvent.click(screen.getByRole('button', { name: 'Select number' }));
    expect(await screen.findByDisplayValue('42')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Apply label' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(request).toHaveBeenCalledOnce();
    });
    expect(request.mock.calls[0]?.[1]?.body).toContain('"label":42');
  });

  it('retargets a new draft after a filename collision without losing its contents', async () => {
    const request = mockDiagramRequests(vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('File already exists', { status: 409 }))
      .mockResolvedValue(new Response('Saved')));
    render(<App />);
    await waitForFileList();
    const filename = screen.getByRole('combobox', { name: 'Diagram file' });
    fireEvent.change(filename, { target: { value: 'draft.json' } });
    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add node' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('File already exists');
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Diagram file' }), { target: { value: 'available.json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('Saved to src/main/diagrams/available.json');
    });
    expect(request.mock.calls[1]?.[0]).toContain('name=available.json');
    expect(request.mock.calls[1]?.[1]?.body).toContain('New node');
    expect(screen.getByText('New node')).toBeDefined();
  });

  it('keeps production free of editing and file controls', () => {
    vi.stubEnv('DEV', false);
    render(<App />);
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add node' })).toBeNull();
  });
});
