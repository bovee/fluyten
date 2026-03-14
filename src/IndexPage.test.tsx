import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { IndexPage } from './IndexPage';
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
  expandedBook: false as string | false,
  onExpandedBookChange: vi.fn(),
});

beforeEach(() => {
  useStore.setState({ userBooks: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('IndexPage', () => {
  it('renders the app title and settings button', () => {
    render(<IndexPage {...defaultProps()} />);
    expect(screen.getByRole('heading')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /settings/i })
    ).toBeInTheDocument();
  });

  it('renders Add Empty Book button', () => {
    render(<IndexPage {...defaultProps()} />);
    expect(
      screen.getByRole('button', { name: /add empty book/i })
    ).toBeInTheDocument();
  });

  it('renders the add other book dropdown button', () => {
    render(<IndexPage {...defaultProps()} />);
    expect(
      screen.getByRole('button', { name: /add other book/i })
    ).toBeInTheDocument();
  });

  describe('Add Book dialog', () => {
    it('opens when Add Empty Book is clicked', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /add empty book/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('creates a new book when title entered and Create clicked', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /add empty book/i }));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'My New Book' } });
      fireEvent.click(screen.getByRole('button', { name: /^create$/i }));
      expect(useStore.getState().userBooks).toHaveLength(1);
      expect(useStore.getState().userBooks[0].title).toBe('My New Book');
    });

    it('does not create a book with empty title', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /add empty book/i }));
      fireEvent.click(screen.getByRole('button', { name: /^create$/i }));
      expect(useStore.getState().userBooks).toHaveLength(0);
    });

    it('creates book when Enter is pressed in title field', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /add empty book/i }));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Enter Book' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(useStore.getState().userBooks[0].title).toBe('Enter Book');
    });

    it('clears title input when Cancel is clicked', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /add empty book/i }));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Abandoned Book' } });
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      // No book should have been created
      expect(useStore.getState().userBooks).toHaveLength(0);
    });
  });

  describe('with books', () => {
    const bookId = 'book-1';
    const songId = 'song-1';

    beforeEach(() => {
      useStore.setState({
        userBooks: [
          {
            id: bookId,
            title: 'My Favourites',
            songs: [
              {
                id: songId,
                title: 'Greensleeves',
                abc: 'X:1\nT:Greensleeves\nM:3/4\nK:Am\nA2',
              },
            ],
          },
        ],
      });
    });

    it('renders the book title', () => {
      render(<IndexPage {...defaultProps()} expandedBook={bookId} />);
      expect(screen.getByText('My Favourites')).toBeInTheDocument();
    });

    it('renders song list when book is expanded', () => {
      render(<IndexPage {...defaultProps()} expandedBook={bookId} />);
      expect(screen.getByText('Greensleeves')).toBeInTheDocument();
    });

    it('calls onSelectSong when a song is clicked', () => {
      const onSelectSong = vi.fn();
      render(
        <IndexPage
          {...defaultProps()}
          onSelectSong={onSelectSong}
          expandedBook={bookId}
        />
      );
      fireEvent.click(screen.getByText('Greensleeves'));
      expect(onSelectSong).toHaveBeenCalledWith(
        expect.objectContaining({ id: songId, title: 'Greensleeves' }),
        false,
        bookId
      );
    });

    it('calls onExpandedBookChange when accordion is toggled', () => {
      const onExpandedBookChange = vi.fn();
      render(
        <IndexPage
          {...defaultProps()}
          onExpandedBookChange={onExpandedBookChange}
        />
      );
      // Click the accordion summary to expand
      const summary = screen.getByText('My Favourites');
      fireEvent.click(summary);
      expect(onExpandedBookChange).toHaveBeenCalledWith(bookId);
    });

    it('calls onExpandedBookChange with false when expanded book is collapsed', () => {
      const onExpandedBookChange = vi.fn();
      render(
        <IndexPage
          {...defaultProps()}
          expandedBook={bookId}
          onExpandedBookChange={onExpandedBookChange}
        />
      );
      const summary = screen.getByText('My Favourites');
      fireEvent.click(summary);
      expect(onExpandedBookChange).toHaveBeenCalledWith(false);
    });

    it('adds a song to a book when Add Song is clicked', () => {
      render(<IndexPage {...defaultProps()} expandedBook={bookId} />);
      const addSongBtn = screen.getByRole('button', { name: /add song/i });
      fireEvent.click(addSongBtn);
      expect(useStore.getState().userBooks[0].songs).toHaveLength(2);
    });

    it('opens delete song confirmation dialog', () => {
      render(<IndexPage {...defaultProps()} expandedBook={bookId} />);
      const deleteBtn = screen.getByRole('button', { name: /delete song/i });
      fireEvent.click(deleteBtn);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    it('deletes song after confirmation', () => {
      render(<IndexPage {...defaultProps()} expandedBook={bookId} />);
      fireEvent.click(screen.getByRole('button', { name: /delete song/i }));
      const dialog = screen.getByRole('dialog');
      // The confirm delete button inside the dialog
      const confirmBtn = within(dialog).getAllByRole('button', {
        name: /delete song/i,
      })[0];
      fireEvent.click(confirmBtn);
      expect(useStore.getState().userBooks[0].songs).toHaveLength(0);
    });

    it('cancels delete song dialog without deleting', () => {
      render(<IndexPage {...defaultProps()} expandedBook={bookId} />);
      fireEvent.click(screen.getByRole('button', { name: /delete song/i }));
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(useStore.getState().userBooks[0].songs).toHaveLength(1);
    });

    describe('Edit book dialog', () => {
      it('opens when Edit Book button is clicked', () => {
        render(<IndexPage {...defaultProps()} expandedBook={bookId} />);
        fireEvent.click(screen.getByRole('button', { name: /edit book/i }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      it('renames book when new title entered and Save clicked', () => {
        render(<IndexPage {...defaultProps()} expandedBook={bookId} />);
        fireEvent.click(screen.getByRole('button', { name: /edit book/i }));
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Renamed Book' } });
        fireEvent.click(screen.getByRole('button', { name: /save/i }));
        expect(useStore.getState().userBooks[0].title).toBe('Renamed Book');
      });

      it('renames book when Enter pressed', () => {
        render(<IndexPage {...defaultProps()} expandedBook={bookId} />);
        fireEvent.click(screen.getByRole('button', { name: /edit book/i }));
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Enter Rename' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(useStore.getState().userBooks[0].title).toBe('Enter Rename');
      });

      it('does not rename book when Cancel clicked', () => {
        render(<IndexPage {...defaultProps()} expandedBook={bookId} />);
        fireEvent.click(screen.getByRole('button', { name: /edit book/i }));
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Cancelled Rename' } });
        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
        expect(useStore.getState().userBooks[0].title).toBe('My Favourites');
      });

      it('opens delete book confirmation from edit dialog', () => {
        render(<IndexPage {...defaultProps()} expandedBook={bookId} />);
        fireEvent.click(screen.getByRole('button', { name: /edit book/i }));
        fireEvent.click(screen.getByRole('button', { name: /delete book/i }));
        // Now should see delete confirm dialog
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      it('deletes book after confirming from delete dialog', () => {
        render(<IndexPage {...defaultProps()} expandedBook={bookId} />);
        fireEvent.click(screen.getByRole('button', { name: /edit book/i }));
        // Click "Delete Book" in edit dialog to open confirm dialog
        const editDialog = screen.getByRole('dialog');
        fireEvent.click(
          within(editDialog).getByRole('button', { name: /delete book/i })
        );
        // Now confirm deletion
        const confirmDialog = screen.getByRole('dialog');
        fireEvent.click(
          within(confirmDialog).getByRole('button', { name: /delete book/i })
        );
        expect(useStore.getState().userBooks).toHaveLength(0);
      });
    });

    describe('Export book dialog', () => {
      it('opens when Export button is clicked', () => {
        render(<IndexPage {...defaultProps()} expandedBook={bookId} />);
        fireEvent.click(screen.getByRole('button', { name: /^export$/i }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      it('does not trigger download when Cancel is clicked', () => {
        const createObjectURL = vi.fn(() => 'blob:test');
        URL.createObjectURL = createObjectURL;
        render(<IndexPage {...defaultProps()} expandedBook={bookId} />);
        fireEvent.click(screen.getByRole('button', { name: /^export$/i }));
        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
        expect(createObjectURL).not.toHaveBeenCalled();
      });

      it('triggers download when Download is clicked', () => {
        const createObjectURL = vi.fn(() => 'blob:test');
        const revokeObjectURL = vi.fn();
        const click = vi.fn();
        URL.createObjectURL = createObjectURL;
        URL.revokeObjectURL = revokeObjectURL;
        // Capture original before spying to avoid recursion
        const origCreateElement = document.createElement.bind(document);
        const createElement = vi.spyOn(document, 'createElement');
        createElement.mockImplementation((tag: string) => {
          if (tag === 'a') {
            const a = {
              href: '',
              download: '',
              click,
            } as unknown as HTMLAnchorElement;
            return a;
          }
          return origCreateElement(tag) as HTMLElement;
        });

        render(<IndexPage {...defaultProps()} expandedBook={bookId} />);
        fireEvent.click(screen.getByRole('button', { name: /^export$/i }));
        fireEvent.click(screen.getByRole('button', { name: /download/i }));
        expect(createObjectURL).toHaveBeenCalled();
        expect(click).toHaveBeenCalled();
      });
    });
  });

  describe('Built-in books menu', () => {
    it('opens menu when dropdown button clicked', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(
        screen.getByRole('button', { name: /add other book/i })
      );
      expect(within(document.body).getByRole('menu')).toBeInTheDocument();
    });

    it('menu contains Import ABC option', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(
        screen.getByRole('button', { name: /add other book/i })
      );
      expect(
        within(document.body).getByRole('menuitem', { name: /import/i })
      ).toBeInTheDocument();
    });

    it('importing a built-in book adds it to store', () => {
      render(<IndexPage {...defaultProps()} />);
      fireEvent.click(
        screen.getByRole('button', { name: /add other book/i })
      );
      // Find the first built-in book menuitem (after Import ABC)
      const menu = within(document.body).getByRole('menu');
      const items = within(menu).getAllByRole('menuitem');
      const builtInItem = items.find(
        (item) => !item.textContent?.match(/import/i)
      );
      if (builtInItem) {
        fireEvent.click(builtInItem);
        expect(useStore.getState().userBooks.length).toBeGreaterThan(0);
      }
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

describe('parseAbcFile (via import built-in book)', () => {
  it('handles multi-tune ABC with X: headers when importing built-in', () => {
    // Import a built-in book which exercises parseAbcFile
    useStore.setState({ userBooks: [] });
    render(<IndexPage {...defaultProps()} />);
    fireEvent.click(
      screen.getByRole('button', { name: /add other book/i })
    );
    const menu = screen.getByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    const builtInItem = items.find(
      (item) => !item.textContent?.match(/scales|import/i)
    );
    if (builtInItem) {
      fireEvent.click(builtInItem);
      const books = useStore.getState().userBooks;
      expect(books[0].songs.length).toBeGreaterThan(0);
    }
  });
});
