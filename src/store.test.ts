import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';

describe('store', () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    useStore.setState({
      instrumentType: 'SOPRANO',
      tuning: 1.0,
      isGerman: false,
      language: '',
      userBooks: [],
    });
  });

  describe('default state', () => {
    it('has correct default values', () => {
      const state = useStore.getState();
      expect(state.instrumentType).toBe('SOPRANO');
      expect(state.tuning).toBe(1.0);
      expect(state.isGerman).toBe(false);
      expect(state.language).toBe('');
      expect(state.userBooks).toEqual([]);
    });
  });

  describe('setters', () => {
    it('setInstrumentType updates instrument', () => {
      useStore.getState().setInstrumentType('ALTO');
      expect(useStore.getState().instrumentType).toBe('ALTO');
    });

    it('setTuning updates tuning', () => {
      useStore.getState().setTuning(0.95);
      expect(useStore.getState().tuning).toBe(0.95);
    });

    it('setIsGerman updates fingering system', () => {
      useStore.getState().setIsGerman(true);
      expect(useStore.getState().isGerman).toBe(true);
    });

    it('setLanguage updates language', () => {
      useStore.getState().setLanguage('de');
      expect(useStore.getState().language).toBe('de');
    });
  });

  describe('addUserBook', () => {
    it('creates book with title, unique ID, and empty songs', () => {
      useStore.getState().addUserBook('My Book');
      const books = useStore.getState().userBooks;
      expect(books).toHaveLength(1);
      expect(books[0].title).toBe('My Book');
      expect(books[0].id).toBeTruthy();
      expect(books[0].songs).toEqual([]);
    });

    it('adds two books with distinct IDs', () => {
      useStore.getState().addUserBook('Book 1');
      useStore.getState().addUserBook('Book 2');
      const books = useStore.getState().userBooks;
      expect(books).toHaveLength(2);
      expect(books[0].id).not.toBe(books[1].id);
    });
  });

  describe('importUserBook', () => {
    it('imports a book with songs', () => {
      const songs = [{ id: 's1', title: 'Song 1', abc: 'X:1\nK:C\nC' }];
      useStore.getState().importUserBook('Imported Book', songs);
      const books = useStore.getState().userBooks;
      expect(books).toHaveLength(1);
      expect(books[0].title).toBe('Imported Book');
      expect(books[0].songs).toEqual(songs);
    });
  });

  describe('removeUserBook', () => {
    it('removes an existing book', () => {
      useStore.getState().addUserBook('To Remove');
      const bookId = useStore.getState().userBooks[0].id;
      useStore.getState().removeUserBook(bookId);
      expect(useStore.getState().userBooks).toHaveLength(0);
    });

    it('does nothing for non-existent ID', () => {
      useStore.getState().addUserBook('Keep');
      useStore.getState().removeUserBook('non-existent');
      expect(useStore.getState().userBooks).toHaveLength(1);
    });
  });

  describe('renameUserBook', () => {
    it('renames a book', () => {
      useStore.getState().addUserBook('Old Name');
      const bookId = useStore.getState().userBooks[0].id;
      useStore.getState().renameUserBook(bookId, 'New Name');
      expect(useStore.getState().userBooks[0].title).toBe('New Name');
    });
  });

  describe('song operations', () => {
    let bookId: string;

    beforeEach(() => {
      useStore.getState().addUserBook('Test Book');
      bookId = useStore.getState().userBooks[0].id;
    });

    it('addSongToBook adds a song to the correct book', () => {
      useStore.getState().addSongToBook(bookId, {
        id: 's1',
        title: 'Test Song',
        abc: 'K:C\nC',
      });
      const books = useStore.getState().userBooks;
      expect(books[0].songs).toHaveLength(1);
      expect(books[0].songs[0].title).toBe('Test Song');
    });

    it('addSongToBook with wrong bookId does not modify any book', () => {
      useStore.getState().addSongToBook('wrong-id', {
        id: 's1',
        title: 'Test Song',
        abc: 'K:C\nC',
      });
      expect(useStore.getState().userBooks[0].songs).toHaveLength(0);
    });

    it('removeSongFromBook removes the song', () => {
      useStore.getState().addSongToBook(bookId, {
        id: 's1',
        title: 'Song',
        abc: 'K:C\nC',
      });
      useStore.getState().removeSongFromBook(bookId, 's1');
      expect(useStore.getState().userBooks[0].songs).toHaveLength(0);
    });

    it('renameSongInBook renames the song', () => {
      useStore.getState().addSongToBook(bookId, {
        id: 's1',
        title: 'Old',
        abc: 'K:C\nC',
      });
      useStore.getState().renameSongInBook(bookId, 's1', 'New');
      expect(useStore.getState().userBooks[0].songs[0].title).toBe('New');
    });

    it('updateSongAbc updates the ABC text', () => {
      useStore.getState().addSongToBook(bookId, {
        id: 's1',
        title: 'Song',
        abc: 'K:C\nC',
      });
      useStore.getState().updateSongAbc(bookId, 's1', 'K:G\nG');
      expect(useStore.getState().userBooks[0].songs[0].abc).toBe('K:G\nG');
    });

    it('updateSongTempo updates the tempo', () => {
      useStore.getState().addSongToBook(bookId, {
        id: 's1',
        title: 'Song',
        abc: 'K:C\nC',
      });
      useStore.getState().updateSongTempo(bookId, 's1', 120);
      expect(useStore.getState().userBooks[0].songs[0].tempo).toBe(120);
    });
  });

  describe('multiple books isolation', () => {
    it('changes to one book do not affect another', () => {
      useStore.getState().addUserBook('Book A');
      useStore.getState().addUserBook('Book B');
      const books = useStore.getState().userBooks;
      const bookAId = books[0].id;

      useStore.getState().addSongToBook(bookAId, {
        id: 's1',
        title: 'Song A',
        abc: 'K:C\nC',
      });

      const updatedBooks = useStore.getState().userBooks;
      expect(updatedBooks[0].songs).toHaveLength(1);
      expect(updatedBooks[1].songs).toHaveLength(0);
    });
  });
});
