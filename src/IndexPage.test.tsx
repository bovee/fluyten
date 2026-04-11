import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { IndexPage } from './IndexPage';
import { axe } from 'jest-axe';
import { useStore } from './store';

// Mock RecorderDetector used transitively via SettingsDialog
vi.mock('./audio/RecorderDetector', () => ({
  RecorderDetector: class {
    start = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn();
    constructor(_cb: unknown) {}
  },
}));

const defaultProps = () => ({
  onSelectSong: vi.fn(),
  onSelectSet: vi.fn(),
});

const songId = 'song-1';
const userSong = {
  id: songId,
  title: 'Greensleeves',
  abc: 'X:1\nT:Greensleeves\nM:3/4\nK:Am\nA2',
};

beforeEach(() => {
  useStore.setState({ songs: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('IndexPage', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<IndexPage {...defaultProps()} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders the app title and settings button', () => {
    render(<IndexPage {...defaultProps()} />);
    expect(screen.getByRole('heading')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /settings/i })
    ).toBeInTheDocument();
  });

  it('renders the Edit Songs button', () => {
    render(<IndexPage {...defaultProps()} />);
    expect(
      screen.getByRole('button', { name: /edit songs/i })
    ).toBeInTheDocument();
  });

  describe('with songs', () => {
    beforeEach(() => {
      useStore.setState({ songs: [userSong] });
    });

    it('renders song title', () => {
      render(<IndexPage {...defaultProps()} />);
      expect(screen.getByText('Greensleeves')).toBeInTheDocument();
    });

    it('calls onSelectSong when a song row is clicked', () => {
      const onSelectSong = vi.fn();
      render(<IndexPage onSelectSong={onSelectSong} onSelectSet={vi.fn()} />);
      fireEvent.click(screen.getByText('Greensleeves'));
      expect(onSelectSong).toHaveBeenCalledWith(
        expect.objectContaining({ id: songId, title: 'Greensleeves' }),
        false
      );
    });

    it('opens Edit Songs menu when Edit Songs button is clicked', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /edit songs/i }));
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('enters select mode via Edit Songs → Select Songs', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /edit songs/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: /select songs/i }));
      // In select mode each song row shows a "Select Song" toggle button
      expect(
        screen.getByRole('button', { name: /select song/i })
      ).toBeInTheDocument();
    });

    it('opens delete confirm dialog from Edit Songs menu', () => {
      render(<IndexPage {...defaultProps()} />);
      // Enter select mode
      fireEvent.click(screen.getByRole('button', { name: /edit songs/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: /select songs/i }));
      // Select the song
      fireEvent.click(screen.getByRole('button', { name: /select song/i }));
      // Open the menu again and choose Delete Songs
      fireEvent.click(screen.getByRole('button', { name: /edit songs/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: /delete songs/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/1 song/i)).toBeInTheDocument();
    });

    it('deletes selected songs after confirmation', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /edit songs/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: /select songs/i }));
      fireEvent.click(screen.getByRole('button', { name: /select song/i }));
      fireEvent.click(screen.getByRole('button', { name: /edit songs/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: /delete songs/i }));
      const confirmDialog = screen.getByRole('dialog');
      fireEvent.click(
        within(confirmDialog).getByRole('button', { name: /delete songs/i })
      );
      expect(useStore.getState().songs).toHaveLength(0);
    });

    it('cancels delete without deleting', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /edit songs/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: /select songs/i }));
      fireEvent.click(screen.getByRole('button', { name: /select song/i }));
      fireEvent.click(screen.getByRole('button', { name: /edit songs/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: /delete songs/i }));
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(useStore.getState().songs).toHaveLength(1);
    });

    it('triggers export download from the song info dialog', () => {
      const createObjectURL = vi.fn(() => 'blob:test');
      const revokeObjectURL = vi.fn();
      const click = vi.fn();
      URL.createObjectURL = createObjectURL;
      URL.revokeObjectURL = revokeObjectURL;
      const origCreateElement = document.createElement.bind(document);
      const createElement = vi.spyOn(document, 'createElement');
      createElement.mockImplementation((tag: string) => {
        if (tag === 'a') {
          return {
            href: '',
            download: '',
            click,
          } as unknown as HTMLAnchorElement;
        }
        return origCreateElement(tag) as HTMLElement;
      });

      render(<IndexPage {...defaultProps()} />);
      // Open song info dialog
      fireEvent.click(screen.getByRole('button', { name: /song info/i }));
      const dialog = screen.getByRole('dialog');
      fireEvent.click(
        within(dialog).getByRole('button', { name: /export song/i })
      );
      expect(createObjectURL).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
    });
  });

  describe('Edit Songs menu', () => {
    it('opens menu when Edit Songs button is clicked', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /edit songs/i }));
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('adds an empty song when Add Empty Song is clicked', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /edit songs/i }));
      fireEvent.click(
        screen.getByRole('menuitem', { name: /add empty song/i })
      );
      expect(useStore.getState().songs).toHaveLength(1);
    });
  });

  describe('Settings dialog', () => {
    it('opens when settings button clicked', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /settings/i }));
      expect(
        screen.getByRole('dialog', { name: /settings/i })
      ).toBeInTheDocument();
    });
  });
});
