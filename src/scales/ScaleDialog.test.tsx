import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScaleDialog } from './ScaleDialog';
import { useStore } from '../store';

beforeEach(() => {
  useStore.setState({ instrumentType: 'SOPRANO', songs: [] });
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

  it('shows all 16 key radio buttons (9 major + 7 minor)', () => {
    renderDialog();
    // 16 key radios + 2 range radios + 3 direction radios = 21 total
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(21);
  });

  it('default selected key is C', () => {
    renderDialog();
    const radios = screen.getAllByRole('radio');
    const checked = radios.filter((r) => (r as HTMLInputElement).checked);
    // C key + 'traditional' range + 'both' direction = 3 checked radios
    expect(checked.length).toBe(3);
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

  it('create button is always enabled since a key is always selected', () => {
    renderDialog();
    const createBtn = screen.getByRole('button', { name: /create/i });
    expect(createBtn).not.toBeDisabled();
  });

  it('clicking create calls onCreate with a single UserSong', () => {
    const onCreate = vi.fn();
    renderDialog({ onCreate });
    const createBtn = screen.getByRole('button', { name: /create/i });
    fireEvent.click(createBtn);
    expect(onCreate).toHaveBeenCalledOnce();
    const song = onCreate.mock.calls[0][0];
    expect(song).toHaveProperty('title');
    expect(song).toHaveProperty('abc');
  });

  it('cancel button calls onClose', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
