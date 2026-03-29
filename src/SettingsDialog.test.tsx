import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SettingsDialog } from './SettingsDialog';
import { useStore } from './store';
import i18n from './i18n';

// Mock RecorderDetector
const { mockStart, mockStop } = vi.hoisted(() => ({
  mockStart: vi.fn().mockResolvedValue(undefined),
  mockStop: vi.fn(),
}));

vi.mock('./audio/RecorderDetector', () => ({
  RecorderDetector: class {
    callbacks: unknown;
    start = mockStart;
    stop = mockStop;
    constructor(callbacks: unknown) {
      this.callbacks = callbacks;
    }
  },
}));

beforeEach(() => {
  useStore.setState({
    instrumentType: 'SOPRANO',
    tuning: 1.0,
    isGerman: false,
    language: 'en',
    songs: [],
  });
  mockStart.mockReset().mockResolvedValue(undefined);
  mockStop.mockReset();
});

const renderDialog = (open = true) =>
  render(<SettingsDialog open={open} onClose={vi.fn()} />);

const clickTab = (name: RegExp) =>
  fireEvent.click(screen.getByRole('tab', { name }));

describe('SettingsDialog', () => {
  it('does not render content when closed', () => {
    renderDialog(false);
    expect(
      screen.queryByRole('slider', { name: /tuning/i })
    ).not.toBeInTheDocument();
  });

  it('General tab shows language select', () => {
    renderDialog();
    // General tab is active by default
    expect(screen.getByLabelText(/language/i)).toBeInTheDocument();
  });

  it('language select shows all 44 language options', () => {
    renderDialog();
    const select = screen.getByLabelText(/language/i);
    fireEvent.mouseDown(select);
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(44);
  });

  it('changing language calls setLanguage and i18n.changeLanguage', () => {
    const spy = vi
      .spyOn(i18n, 'changeLanguage')
      .mockResolvedValue(undefined as never);
    renderDialog();
    const select = screen.getByLabelText(/language/i);
    fireEvent.mouseDown(select);
    const germanOption = screen.getByRole('option', { name: /deutsch/i });
    fireEvent.click(germanOption);
    expect(useStore.getState().language).toBe('de');
    expect(spy).toHaveBeenCalledWith('de');
    spy.mockRestore();
  });

  it('Instrument tab shows recorder type, tuning slider, detect button, and german toggle', () => {
    renderDialog();
    clickTab(/instrument/i);
    expect(screen.getByLabelText(/recorder type/i)).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /tuning/i })).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /detect/i })).toBeInTheDocument();
  });

  it('instrument type select excludes ALL and shows 5 recorder types', () => {
    renderDialog();
    clickTab(/instrument/i);
    const select = screen.getByLabelText(/recorder type/i);
    fireEvent.mouseDown(select);
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(5);
    expect(options.map((o) => o.getAttribute('data-value'))).not.toContain(
      'ALL'
    );
  });

  it('changing instrument type updates store', () => {
    renderDialog();
    clickTab(/instrument/i);
    const select = screen.getByLabelText(/recorder type/i);
    fireEvent.mouseDown(select);
    const altoOption = screen
      .getAllByRole('option')
      .find((o) => o.getAttribute('data-value') === 'ALTO')!;
    fireEvent.click(altoOption);
    expect(useStore.getState().instrumentType).toBe('ALTO');
  });

  it('tuning slider displays current tuning value', () => {
    useStore.setState({ tuning: 0.95 });
    renderDialog();
    clickTab(/instrument/i);
    expect(screen.getAllByText(/0\.95/).length).toBeGreaterThan(0);
  });

  it('german fingering toggle reflects store state', () => {
    useStore.setState({ isGerman: true });
    renderDialog();
    clickTab(/instrument/i);
    const toggle = screen.getByRole('switch');
    expect((toggle as HTMLInputElement).checked).toBe(true);
  });

  it('toggling german fingering updates store', () => {
    renderDialog();
    clickTab(/instrument/i);
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    expect(useStore.getState().isGerman).toBe(true);
  });

  it('detect button opens detection dialog with stepper', async () => {
    renderDialog();
    clickTab(/instrument/i);
    const detectBtn = screen.getByRole('button', { name: /detect/i });
    fireEvent.click(detectBtn);
    const detectDialog = await screen.findByRole('dialog', { name: /detect/i });
    expect(detectDialog).toBeInTheDocument();
    expect(
      within(detectDialog).getAllByText(/recorder type/i).length
    ).toBeGreaterThan(0);
  });

  it('closing detection dialog calls detector.stop()', async () => {
    renderDialog();
    clickTab(/instrument/i);
    fireEvent.click(screen.getByRole('button', { name: /detect/i }));
    const detectDialog = await screen.findByRole('dialog', { name: /detect/i });
    const closeBtn = within(detectDialog).getByRole('button', {
      name: /close/i,
    });
    fireEvent.click(closeBtn);
    expect(mockStop).toHaveBeenCalled();
  });

  it('onClose callback fires when dialog closes', () => {
    const onClose = vi.fn();
    render(<SettingsDialog open={true} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: /settings/i });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
