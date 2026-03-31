import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';

describe('store', () => {
  beforeEach(() => {
    useStore.setState({
      instrumentType: 'SOPRANO',
      tuning: 1.0,
      isGerman: false,
      language: '',
      songs: [],
    });
  });

  describe('default state', () => {
    it('has correct default values', () => {
      const state = useStore.getState();
      expect(state.instrumentType).toBe('SOPRANO');
      expect(state.tuning).toBe(1.0);
      expect(state.isGerman).toBe(false);
      expect(state.language).toBe('');
      expect(state.songs).toEqual([]);
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

  describe('addSongs', () => {
    it('appends a song', () => {
      useStore
        .getState()
        .addSongs([{ id: 's1', title: 'My Song', abc: 'T:My Song\nK:C\nC' }]);
      const songs = useStore.getState().songs;
      expect(songs).toHaveLength(1);
      expect(songs[0].title).toBe('My Song');
    });

    it('appends multiple songs', () => {
      const batch = [
        { id: 's1', title: 'Song 1', abc: 'K:C\nC' },
        { id: 's2', title: 'Song 2', abc: 'K:G\nG' },
      ];
      useStore.getState().addSongs(batch);
      expect(useStore.getState().songs).toHaveLength(2);
      expect(useStore.getState().songs[0].id).not.toBe(
        useStore.getState().songs[1].id
      );
    });

    it('appends to existing songs', () => {
      useStore
        .getState()
        .addSongs([{ id: 's0', title: 'Existing', abc: 'K:C\nC' }]);
      useStore.getState().addSongs([{ id: 's1', title: 'New', abc: 'K:G\nG' }]);
      expect(useStore.getState().songs).toHaveLength(2);
    });
  });

  describe('removeSong', () => {
    it('removes an existing song', () => {
      useStore
        .getState()
        .addSongs([{ id: 's1', title: 'Song', abc: 'K:C\nC' }]);
      useStore.getState().removeSong('s1');
      expect(useStore.getState().songs).toHaveLength(0);
    });

    it('does nothing for non-existent ID', () => {
      useStore
        .getState()
        .addSongs([{ id: 's1', title: 'Song', abc: 'K:C\nC' }]);
      useStore.getState().removeSong('non-existent');
      expect(useStore.getState().songs).toHaveLength(1);
    });
  });

  describe('updateSongAbc', () => {
    it('updates the ABC text', () => {
      useStore
        .getState()
        .addSongs([{ id: 's1', title: 'Song', abc: 'K:C\nC' }]);
      useStore.getState().updateSongAbc('s1', 'K:G\nG');
      expect(useStore.getState().songs[0].abc).toBe('K:G\nG');
    });

    it('updates title from T: header', () => {
      useStore
        .getState()
        .addSongs([{ id: 's1', title: 'Old', abc: 'T:Old\nK:C\nC' }]);
      useStore
        .getState()
        .updateSongAbc('s1', 'T:New Title\nM:4/4\nL:1/4\nK:C\nC D E F |');
      expect(useStore.getState().songs[0].title).toBe('New Title');
    });

    it('derives beats', () => {
      useStore.getState().addSongs([{ id: 's1', title: '', abc: 'K:C\nC' }]);
      useStore
        .getState()
        .updateSongAbc('s1', 'T:Test\nM:4/4\nL:1/4\nK:C\nC D E F |');
      expect(useStore.getState().songs[0].beats).toBe(4);
    });
  });

  describe('setMethod', () => {
    it('updates method and recomputes difficulty for all songs', () => {
      useStore
        .getState()
        .addSongs([
          { id: 's1', title: '', abc: 'T:Test\nM:4/4\nL:1/4\nK:C\nC D E F |' },
        ]);
      useStore.getState().setMethod('orrC');
      expect(useStore.getState().method).toBe('orrC');
      expect(useStore.getState().songs[0].difficulty).toBe('1.29');
    });
  });

  describe('updateSongTempo', () => {
    it('updates the tempo', () => {
      useStore
        .getState()
        .addSongs([{ id: 's1', title: 'Song', abc: 'K:C\nC' }]);
      useStore.getState().updateSongTempo('s1', 120);
      expect(useStore.getState().songs[0].tempo).toBe(120);
    });
  });

  describe('migration from userBooks (version 0 → 1)', () => {
    it('flattens userBooks into songs', () => {
      const { migrate } = useStore.persist.getOptions();
      const oldState = {
        userBooks: [
          {
            id: 'b1',
            title: 'Book A',
            songs: [{ id: 's1', title: 'Song 1', abc: 'K:C\nC' }],
          },
          {
            id: 'b2',
            title: 'Book B',
            songs: [{ id: 's2', title: 'Song 2', abc: 'K:G\nG' }],
          },
        ],
      };
      const migrated = migrate!(oldState, 0) as Record<string, unknown>;
      expect(migrated.songs).toHaveLength(2);
      expect((migrated.songs as { id: string }[])[0].id).toBe('s1');
      expect((migrated.songs as { id: string }[])[1].id).toBe('s2');
      expect(migrated.userBooks).toBeUndefined();
    });
  });
});
