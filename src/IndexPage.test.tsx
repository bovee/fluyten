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

  it('renders Add Song and Edit Songs buttons', () => {
    render(<IndexPage {...defaultProps()} />);
    expect(screen.getByRole('button', { name: /add song/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit songs/i })).toBeInTheDocument();
  });

  it('Edit Songs button is disabled when no songs are selected', () => {
    useStore.setState({ songs: [userSong] });
    render(<IndexPage {...defaultProps()} />);
    expect(screen.getByRole('button', { name: /edit songs/i })).toBeDisabled();
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
      render(<IndexPage onSelectSong={onSelectSong} />);
      fireEvent.click(screen.getByText('Greensleeves'));
      expect(onSelectSong).toHaveBeenCalledWith(
        expect.objectContaining({ id: songId, title: 'Greensleeves' }),
        false
      );
    });

    it('selecting a song enables the Edit Songs button', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /select song/i }));
      expect(screen.getByRole('button', { name: /edit songs/i })).not.toBeDisabled();
    });

    it('opens Edit Songs dialog when Edit Songs button is clicked after selecting', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /select song/i }));
      fireEvent.click(screen.getByRole('button', { name: /edit songs/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('opens delete confirm dialog from Edit Songs dialog', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /select song/i }));
      fireEvent.click(screen.getByRole('button', { name: /edit songs/i }));
      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: /delete songs/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/1 song/i)).toBeInTheDocument();
    });

    it('deletes selected songs after confirmation', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /select song/i }));
      fireEvent.click(screen.getByRole('button', { name: /edit songs/i }));
      fireEvent.click(screen.getByRole('button', { name: /delete songs/i }));
      const confirmDialog = screen.getByRole('dialog');
      fireEvent.click(
        within(confirmDialog).getByRole('button', { name: /delete songs/i })
      );
      expect(useStore.getState().songs).toHaveLength(0);
    });

    it('cancels delete without deleting', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /select song/i }));
      fireEvent.click(screen.getByRole('button', { name: /edit songs/i }));
      fireEvent.click(screen.getByRole('button', { name: /delete songs/i }));
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(useStore.getState().songs).toHaveLength(1);
    });

    it('triggers export download when Export Songs is clicked', () => {
      const createObjectURL = vi.fn(() => 'blob:test');
      const revokeObjectURL = vi.fn();
      const click = vi.fn();
      URL.createObjectURL = createObjectURL;
      URL.revokeObjectURL = revokeObjectURL;
      const origCreateElement = document.createElement.bind(document);
      const createElement = vi.spyOn(document, 'createElement');
      createElement.mockImplementation((tag: string) => {
        if (tag === 'a') {
          return { href: '', download: '', click } as unknown as HTMLAnchorElement;
        }
        return origCreateElement(tag) as HTMLElement;
      });

      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /select song/i }));
      fireEvent.click(screen.getByRole('button', { name: /edit songs/i }));
      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: /export songs/i }));
      expect(createObjectURL).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
    });
  });

  describe('Add Song menu', () => {
    it('opens menu when + button is clicked', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /add song/i }));
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('adds an empty song when Add Empty Song is clicked', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /add song/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: /add empty song/i }));
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
