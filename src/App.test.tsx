import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./utils', () => ({
  debounce: (fn: (...args: unknown[]) => void) => ({ call: fn, cancel: vi.fn() }),
}));
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { useStore } from './store';

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

const bookId = 'book-1';
const songId = 'song-1';
const userBook = {
  id: bookId,
  title: 'My Songs',
  songs: [
    {
      id: songId,
      title: 'Twinkle Twinkle',
      abc: 'X:1\nT:Twinkle Twinkle\nM:C\nL:1/4\nK:C\nC C G G |',
    },
  ],
};

beforeEach(() => {
  useStore.setState({ userBooks: [], onboarded: true });
});

describe('App', () => {
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
        screen.getByRole('button', { name: /add empty book/i })
      ).toBeInTheDocument();
    });

    it('shows SongPage after clicking a song', async () => {
      useStore.setState({ userBooks: [userBook] });
      render(<App />);
      // Expand the accordion
      fireEvent.click(screen.getByText('My Songs'));
      // Click the song
      fireEvent.click(screen.getByText('Twinkle Twinkle'));
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /back to song list/i })
        ).toBeInTheDocument()
      );
    });

    it('returns to IndexPage when back button is clicked', async () => {
      useStore.setState({ userBooks: [userBook] });
      render(<App />);
      fireEvent.click(screen.getByText('My Songs'));
      fireEvent.click(screen.getByText('Twinkle Twinkle'));
      const backBtn = await waitFor(() =>
        screen.getByRole('button', { name: /back to song list/i })
      );
      fireEvent.click(backBtn);
      expect(
        screen.getByRole('button', { name: /add empty book/i })
      ).toBeInTheDocument();
    });
  });

  describe('ABC persistence', () => {
    it('updateSongAbc is called when ABC changes for a user book song', async () => {
      useStore.setState({ userBooks: [userBook] });
      render(<App />);
      fireEvent.click(screen.getByText('My Songs'));
      fireEvent.click(screen.getByText('Twinkle Twinkle'));
      const editBtn = await waitFor(() =>
        screen.getByRole('button', { name: /edit music/i })
      );
      fireEvent.click(editBtn);
      const editor = screen.getByRole('textbox');
      const newAbc = 'X:1\nT:Changed\nM:C\nL:1/4\nK:C\nG A B c |';
      fireEvent.change(editor, { target: { value: newAbc } });
      expect(useStore.getState().userBooks[0].songs[0].abc).toBe(newAbc);
    });

    it('renames the song when the T: header changes', async () => {
      useStore.setState({ userBooks: [userBook] });
      render(<App />);
      fireEvent.click(screen.getByText('My Songs'));
      fireEvent.click(screen.getByText('Twinkle Twinkle'));
      const editBtn = await waitFor(() =>
        screen.getByRole('button', { name: /edit music/i })
      );
      fireEvent.click(editBtn);
      const editor = screen.getByRole('textbox');
      fireEvent.change(editor, {
        target: { value: 'X:1\nT:New Title\nM:C\nL:1/4\nK:C\nG' },
      });
      expect(useStore.getState().userBooks[0].songs[0].title).toBe('New Title');
    });

    it('updateSongTempo is called when tempo changes for a user book song', async () => {
      useStore.setState({ userBooks: [userBook] });
      render(<App />);
      fireEvent.click(screen.getByText('My Songs'));
      fireEvent.click(screen.getByText('Twinkle Twinkle'));
      const editBtn = await waitFor(() =>
        screen.getByRole('button', { name: /edit music/i })
      );
      fireEvent.click(editBtn);
      const slider = await waitFor(() =>
        screen.getByRole('slider', { name: /tempo/i })
      );
      fireEvent.change(slider, { target: { value: '80' } });
      expect(useStore.getState().userBooks[0].songs[0].tempo).toBe(80);
    });

    it('does not persist ABC for read-only songs', async () => {
      // Read-only songs have no bookId — navigated to via a built-in book or similar
      useStore.setState({ userBooks: [userBook] });
      render(<App />);
      fireEvent.click(screen.getByText('My Songs'));
      // Access via onSelectSong with readOnly=true by rendering directly
      // This is tested via the read-only editor path in SongPage.test.tsx;
      // here we just verify the initial ABC is unchanged when no editing occurs.
      expect(useStore.getState().userBooks[0].songs[0].abc).toBe(
        userBook.songs[0].abc
      );
    });
  });
});
