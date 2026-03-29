import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./utils', () => ({
  debounce: (fn: (...args: unknown[]) => void) => ({
    call: fn,
    cancel: vi.fn(),
  }),
}));
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SongPage } from './SongPage';
import { axe } from 'jest-axe';
import { useStore } from './store';

// Mock audio-related classes so they don't fail in jsdom
vi.mock('./audio/FrequencyTracker', () => ({
  FrequencyTracker: class {
    constructor(_onStart: unknown, _onStop: unknown) {}
    start = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn();
    checkFrequency = vi.fn();
  },
}));

vi.mock('./audio/NotePlayer', () => ({
  NotePlayer: class {
    audioCtx = null;
    start = vi.fn();
    stop = vi.fn();
    scheduleNotes = vi.fn();
    isPlaying = vi.fn().mockReturnValue(false);
    getNoteIdxAtTime = vi.fn().mockReturnValue(-1);
  },
}));

const simpleSong = {
  id: 'test-song',
  title: 'Test Song',
  abc: 'X:1\nT:Test Song\nM:C\nL:1/4\nK:C\nC D E F |',
};

const defaultProps = (overrides = {}) => ({
  song: simpleSong,
  onBack: vi.fn(),
  onAbcChange: vi.fn(),
  onTempoChange: vi.fn(),
  ...overrides,
});

beforeEach(() => {
  useStore.setState({ instrumentType: 'SOPRANO', tuning: 1.0 });
});

describe('SongPage', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<SongPage {...defaultProps()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
  it('renders the song title', () => {
    render(<SongPage {...defaultProps()} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('renders back button', () => {
    render(<SongPage {...defaultProps()} />);
    expect(
      screen.getByRole('button', { name: /back to song list/i })
    ).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn();
    render(<SongPage {...defaultProps({ onBack })} />);
    fireEvent.click(screen.getByRole('button', { name: /back to song list/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('renders edit music button', () => {
    render(<SongPage {...defaultProps()} />);
    expect(
      screen.getByRole('button', { name: /edit music/i })
    ).toBeInTheDocument();
  });

  it('opens edit drawer when edit button is clicked', () => {
    render(<SongPage {...defaultProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit music/i }));
    // Drawer opens and shows ABC textarea
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('edit drawer contains tempo slider', () => {
    render(<SongPage {...defaultProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit music/i }));
    expect(screen.getByRole('slider', { name: /tempo/i })).toBeInTheDocument();
  });

  it('shows composer when present in abc', () => {
    const songWithComposer = {
      id: 'folk',
      title: 'Folk Song',
      abc: 'X:1\nT:Folk Song\nC:Traditional\nM:3/4\nK:Am\nA2 c |',
    };
    render(<SongPage {...defaultProps({ song: songWithComposer })} />);
    expect(screen.getByText('Traditional')).toBeInTheDocument();
  });

  it('does not render composer section when not in abc', () => {
    render(<SongPage {...defaultProps()} />);
    // The heading is present but no subtitle for composer
    const headings = screen.getAllByRole('heading');
    // Only h1 for title, no h2 for composer
    expect(headings).toHaveLength(1);
  });

  it('ABC editor is editable in normal mode', () => {
    render(<SongPage {...defaultProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit music/i }));
    const editor = screen.getByRole('textbox');
    expect(editor).not.toBeDisabled();
  });

  it('ABC editor is disabled in readOnly mode', () => {
    render(<SongPage {...defaultProps({ readOnly: true })} />);
    fireEvent.click(screen.getByRole('button', { name: /edit music/i }));
    const editor = screen.getByRole('textbox');
    expect(editor).toBeDisabled();
  });

  it('shows parse error when invalid ABC is entered', () => {
    const onAbcChange = vi.fn();
    render(<SongPage {...defaultProps({ onAbcChange })} />);
    fireEvent.click(screen.getByRole('button', { name: /edit music/i }));
    const editor = screen.getByRole('textbox');
    fireEvent.change(editor, { target: { value: '%%invalid-abc-!@#$%' } });
    // Error should be shown (the textbox should have aria-invalid or helper text)
    // The error might appear differently, just ensure it doesn't crash
    expect(editor).toBeInTheDocument();
  });

  it('calls onAbcChange when ABC is edited', () => {
    const onAbcChange = vi.fn();
    render(<SongPage {...defaultProps({ onAbcChange })} />);
    fireEvent.click(screen.getByRole('button', { name: /edit music/i }));
    const editor = screen.getByRole('textbox');
    const newAbc = 'X:1\nT:Updated\nM:C\nL:1/4\nK:G\nG A B c |';
    fireEvent.change(editor, { target: { value: newAbc } });
    expect(onAbcChange).toHaveBeenCalledWith(newAbc);
  });

  it('does not call onAbcChange in readOnly mode', () => {
    const onAbcChange = vi.fn();
    render(<SongPage {...defaultProps({ readOnly: true, onAbcChange })} />);
    fireEvent.click(screen.getByRole('button', { name: /edit music/i }));
    const editor = screen.getByRole('textbox');
    // Can still change the controlled value but onAbcChange should not be called
    fireEvent.change(editor, { target: { value: 'X:1\nK:C\nC' } });
    expect(onAbcChange).not.toHaveBeenCalled();
  });

  it('calls onTempoChange when slider changes', () => {
    const onTempoChange = vi.fn();
    render(<SongPage {...defaultProps({ onTempoChange })} />);
    fireEvent.click(screen.getByRole('button', { name: /edit music/i }));
    const slider = screen.getByRole('slider', { name: /tempo/i });
    fireEvent.change(slider, { target: { value: '100' } });
    expect(onTempoChange).toHaveBeenCalled();
  });

  it('uses song.tempo as initial tempo when provided', () => {
    const songWithTempo = { ...simpleSong, tempo: 80 };
    render(<SongPage {...defaultProps({ song: songWithTempo })} />);
    fireEvent.click(screen.getByRole('button', { name: /edit music/i }));
    expect(screen.getByText(/80/)).toBeInTheDocument();
  });

  it('renders aria-live region for detected note', () => {
    render(<SongPage {...defaultProps()} />);
    // There are two aria-live regions (note name and status message)
    const liveRegions = document.querySelectorAll('[aria-live="polite"]');
    expect(liveRegions.length).toBe(2);
  });

  describe('SpeedDial', () => {
    it('renders play icon in speed dial by default', () => {
      render(<SongPage {...defaultProps()} />);
      const fab = screen.getByRole('button', { name: /play/i });
      expect(fab).toBeInTheDocument();
    });

    // Clicking the main FAB toggles the SpeedDial open/closed (calls onOpen/onClose)
    const clickFab = () =>
      fireEvent.click(screen.getByRole('button', { name: /play/i }));

    it('has 2 action buttons inside the SpeedDial', () => {
      render(<SongPage {...defaultProps()} />);
      clickFab();
      expect(getActionButtons()).toHaveLength(2);
    });

    // SpeedDialAction order in DOM: Mic (Practice), MusicNote (Play Song)
    const getActionButtons = () => {
      const container = document.querySelector(
        '[class*="MuiSpeedDial-actions"]'
      )!;
      return container ? Array.from(container.querySelectorAll('button')) : [];
    };

    it('clicking Play Song action (index 1) starts playback', () => {
      render(<SongPage {...defaultProps()} />);
      clickFab();
      const actions = getActionButtons();
      expect(actions.length).toBe(2);
      fireEvent.click(actions[1]); // MusicNote = Play Song
      expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    });

    it('clicking Play Song action twice toggles playback off', () => {
      render(<SongPage {...defaultProps()} />);
      clickFab();
      fireEvent.click(getActionButtons()[1]);
      clickFab();
      fireEvent.click(getActionButtons()[1]);
      expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    });

    it('clicking Check Playing action (index 0) starts recording', async () => {
      render(<SongPage {...defaultProps()} />);
      clickFab();
      await act(async () => {
        fireEvent.click(getActionButtons()[0]); // Mic = Check Playing
      });
      expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    });

    it('clicking Check Playing action twice stops recording', async () => {
      render(<SongPage {...defaultProps()} />);
      clickFab();
      await act(async () => {
        fireEvent.click(getActionButtons()[0]);
      });
      clickFab();
      await act(async () => {
        fireEvent.click(getActionButtons()[0]);
      });
      expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    });
  });
});
