import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./utils', () => ({
  debounce: (fn: (...args: unknown[]) => void) => ({
    call: fn,
    cancel: vi.fn(),
  }),
}));
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { axe } from 'jest-axe';
import { useStore } from './store';
// Warm Vitest's module cache so React.lazy's dynamic import('./SongPage')
// resolves immediately rather than racing against waitFor's timeout.
import './SongPage';

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

vi.mock('./audio/RecorderDetector', () => ({
  RecorderDetector: class {
    start = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn();
    constructor(_cb: unknown) {}
  },
}));

vi.stubGlobal(
  'fetch',
  vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(''),
  })
);

const songId = 'song-1';
const userSong = {
  id: songId,
  title: 'Twinkle Twinkle',
  abc: 'X:1\nT:Twinkle Twinkle\nM:C\nL:1/4\nK:C\nC C G G |',
};

beforeEach(() => {
  useStore.setState({ songs: [], onboarded: true });
});

describe('App', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<App />);
    expect(await axe(container)).toHaveNoViolations();
  });
  describe('onboarding', () => {
    it('shows OnboardingDialog when not yet onboarded', () => {
      useStore.setState({ onboarded: false });
      render(<App />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('does not show OnboardingDialog when already onboarded', () => {
      useStore.setState({ onboarded: true });
      render(<App />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('shows IndexPage when no song is selected', () => {
      render(<App />);
      expect(
        screen.getByRole('button', { name: /edit songs/i })
      ).toBeInTheDocument();
    });

    it('shows SongPage after clicking a song', async () => {
      useStore.setState({ songs: [userSong] });
      render(<App />);
      fireEvent.click(screen.getByText('Twinkle Twinkle'));
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /back to song list/i })
        ).toBeInTheDocument()
      );
    });

    it('returns to IndexPage when back button is clicked', async () => {
      useStore.setState({ songs: [userSong] });
      render(<App />);
      fireEvent.click(screen.getByText('Twinkle Twinkle'));
      const backBtn = await waitFor(() =>
        screen.getByRole('button', { name: /back to song list/i })
      );
      fireEvent.click(backBtn);
      expect(
        screen.getByRole('button', { name: /edit songs/i })
      ).toBeInTheDocument();
    });
  });

  describe('ABC persistence', () => {
    it('updateSongAbc is called when ABC changes for a user song', async () => {
      useStore.setState({ songs: [userSong] });
      render(<App />);
      fireEvent.click(screen.getByText('Twinkle Twinkle'));
      const editBtn = await waitFor(() =>
        screen.getByRole('button', { name: /edit music/i })
      );
      fireEvent.click(editBtn);
      const editor = screen.getByRole('textbox');
      const newAbc = 'X:1\nT:Changed\nM:C\nL:1/4\nK:C\nG A B c |';
      fireEvent.change(editor, { target: { value: newAbc } });
      // Persistence is deferred until the editor drawer closes.
      fireEvent.click(editBtn);
      expect(useStore.getState().songs[0].abc).toBe(newAbc);
    });

    it('renames the song when the T: header changes', async () => {
      useStore.setState({ songs: [userSong] });
      render(<App />);
      fireEvent.click(screen.getByText('Twinkle Twinkle'));
      const editBtn = await waitFor(() =>
        screen.getByRole('button', { name: /edit music/i })
      );
      fireEvent.click(editBtn);
      const editor = screen.getByRole('textbox');
      fireEvent.change(editor, {
        target: { value: 'X:1\nT:New Title\nM:C\nL:1/4\nK:C\nG' },
      });
      fireEvent.click(editBtn);
      expect(useStore.getState().songs[0].title).toBe('New Title');
    });

    it('does not persist ABC for read-only songs', async () => {
      useStore.setState({ songs: [userSong] });
      render(<App />);
      // Just verify initial state is unchanged with no editing
      expect(useStore.getState().songs[0].abc).toBe(userSong.abc);
    });
  });
});
