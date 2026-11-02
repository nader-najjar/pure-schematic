import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../main/App.tsx';

afterEach(cleanup);

describe('App', () => {
  it('loads the example diagram with native navigation controls', () => {
    vi.stubGlobal('ResizeObserver', class {
      public observe(): void { /* Layout is verified in the browser. */ }
      public unobserve(): void { /* No layout observer in jsdom. */ }
      public disconnect(): void { /* No layout observer in jsdom. */ }
    });
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Pure Schematic' })).toBeDefined();
    expect(screen.getByText('Shape the idea')).toBeDefined();
    expect(screen.getByText('Make a small change')).toBeDefined();
    expect(screen.getByText('Review together')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Zoom In' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Fit View' })).toBeDefined();
  });
});
