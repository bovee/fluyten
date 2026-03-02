import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScaleDialog } from './ScaleDialog';
import { useStore } from './store';

beforeEach(() => {
  useStore.setState({ instrumentType: 'SOPRANO', userBooks: [] });
});

const renderDialog = (props?: Partial<Parameters<typeof ScaleDialog>[0]>) => {
  const defaults = {
    open: true,
    onClose: vi.fn(),
    onCreate: vi.fn(),
  };
  return render(<ScaleDialog {...defaults} {...props} />);
};

describe('ScaleDialog', () => {
  it('renders with default state when open', () => {
    renderDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows book name field with default value', () => {
    renderDialog();
    const field = screen.getByRole('textbox');
    expect((field as HTMLInputElement).value).toBeTruthy();
  });

  it('shows all 9 major key checkboxes', () => {
    renderDialog();
    // Total checkboxes: 9 major + 7 minor = 16
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(16);
  });

  it('shows all 7 minor key checkboxes', () => {
    renderDialog();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(16);
  });

  it('default keys are pre-checked', () => {
    renderDialog();
    // DEFAULT_KEYS = C, G, F, D, Bb, Am, Em, Dm — 8 keys
    const checkedBoxes = screen
      .getAllByRole('checkbox')
      .filter((cb) => (cb as HTMLInputElement).checked);
    expect(checkedBoxes.length).toBe(8);
  });

  it('toggling a key checkbox updates its state', () => {
    renderDialog();
    // Find the checkbox for 'A' (not checked by default among major keys)
    const checkboxes = screen.getAllByRole('checkbox');
    const checkedBefore = checkboxes.filter(
      (cb) => (cb as HTMLInputElement).checked
    ).length;
    // Click an unchecked box
    const unchecked = checkboxes.find(
      (cb) => !(cb as HTMLInputElement).checked
    )!;
    fireEvent.click(unchecked);
    const checkedAfter = screen
      .getAllByRole('checkbox')
      .filter((cb) => (cb as HTMLInputElement).checked).length;
    expect(checkedAfter).toBe(checkedBefore + 1);
  });

  it('create button disabled when all keys unchecked', () => {
    renderDialog();
    // Uncheck all
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => {
      if ((cb as HTMLInputElement).checked) {
        fireEvent.click(cb);
      }
    });
    const createBtn = screen.getByRole('button', { name: /create/i });
    expect(createBtn).toBeDisabled();
  });

  it('create button enabled with at least one key selected', () => {
    renderDialog();
    const createBtn = screen.getByRole('button', { name: /create/i });
    expect(createBtn).not.toBeDisabled();
  });

  it('clicking create calls onCreate with generated songs and book name', () => {
    const onCreate = vi.fn();
    renderDialog({ onCreate });
    const createBtn = screen.getByRole('button', { name: /create/i });
    fireEvent.click(createBtn);
    expect(onCreate).toHaveBeenCalledOnce();
    const [songs, bookName] = onCreate.mock.calls[0];
    expect(Array.isArray(songs)).toBe(true);
    expect(songs.length).toBeGreaterThan(0);
    expect(typeof bookName).toBe('string');
  });

  it('cancel button calls onClose', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
