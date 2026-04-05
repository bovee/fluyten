import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GenerateNotesDialog } from './GenerateNotesDialog';
import { axe } from 'jest-axe';
import { useStore } from '../store';

beforeEach(() => {
  useStore.setState({ instrumentType: 'SOPRANO', songs: [] });
});

const renderDialog = (
  props?: Partial<Parameters<typeof GenerateNotesDialog>[0]>
) => {
  const defaults = {
    open: true,
    onClose: vi.fn(),
    onGenerate: vi.fn(),
  };
  return render(<GenerateNotesDialog {...defaults} {...props} />);
};

describe('GenerateNotesDialog', () => {
  it('should have no accessibility violations', async () => {
    const { container } = renderDialog();
    expect(await axe(container)).toHaveNoViolations();
  });
  it('renders with default state when open', () => {
    renderDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows all 22 key radio buttons (11 major + 11 minor)', () => {
    renderDialog();
    // 22 key radios + 2 range radios + 3 direction radios = 27 total
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(27);
  });

  it('default selected key is C and direction is ascending', () => {
    renderDialog();
    const radios = screen.getAllByRole('radio');
    const checked = radios.filter((r) => (r as HTMLInputElement).checked);
    // C key + 'traditional' range + 'ascending' direction = 3 checked radios
    expect(checked.length).toBe(3);
    const checkedValues = checked.map((r) => (r as HTMLInputElement).value);
    expect(checkedValues).toContain('C');
    expect(checkedValues).toContain('traditional');
    expect(checkedValues).toContain('ascending');
  });

  it('selecting a different key updates the selection', () => {
    renderDialog();
    const radios = screen.getAllByRole('radio');
    // Find an unchecked key radio (skip the range/direction radios at the start)
    const unchecked = radios.find(
      (r) =>
        !(r as HTMLInputElement).checked &&
        (r as HTMLInputElement).value.length <= 3
    )!;
    fireEvent.click(unchecked);
    expect((unchecked as HTMLInputElement).checked).toBe(true);
  });

  it('generate button is always enabled since a key is always selected', () => {
    renderDialog();
    const generateBtn = screen.getByRole('button', { name: /generate/i });
    expect(generateBtn).not.toBeDisabled();
  });

  it('clicking generate calls onGenerate with a notes ABC string', () => {
    const onGenerate = vi.fn();
    renderDialog({ onGenerate });
    const generateBtn = screen.getByRole('button', { name: /generate/i });
    fireEvent.click(generateBtn);
    expect(onGenerate).toHaveBeenCalledOnce();
    const notesAbc = onGenerate.mock.calls[0][0];
    expect(typeof notesAbc).toBe('string');
    expect(notesAbc.length).toBeGreaterThan(0);
  });

  it('cancel button calls onClose', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
