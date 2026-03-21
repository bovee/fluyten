import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { type RecorderType } from './instrument';

export interface UserSong {
  id: string;
  title: string;
  abc: string;
  tempo?: number;
}

export interface UserBook {
  id: string;
  title: string;
  songs: UserSong[];
  sourceId?: string;
}

interface SettingsState {
  onboarded: boolean;
  setOnboarded: () => void;
  instrumentType: RecorderType;
  setInstrumentType: (type: RecorderType) => void;
  tuning: number;
  setTuning: (tuning: number) => void;
  isGerman: boolean;
  setIsGerman: (isGerman: boolean) => void;
  language: string;
  setLanguage: (language: string) => void;
  userBooks: UserBook[];
  addUserBook: (title: string) => void;
  importUserBook: (title: string, songs: UserSong[], sourceId?: string) => void;
  removeUserBook: (bookId: string) => void;
  renameUserBook: (bookId: string, title: string) => void;
  addSongToBook: (bookId: string, song: UserSong) => void;
  removeSongFromBook: (bookId: string, songId: string) => void;
  renameSongInBook: (bookId: string, songId: string, title: string) => void;
  updateSongAbc: (bookId: string, songId: string, abc: string) => void;
  updateSongTempo: (bookId: string, songId: string, tempo: number) => void;
}

export const useStore = create<SettingsState>()(
  persist(
    (set) => ({
      onboarded: false,
      setOnboarded: () => set({ onboarded: true }),
      instrumentType: 'SOPRANO',
      setInstrumentType: (instrumentType) => set({ instrumentType }),
      tuning: 1.0,
      setTuning: (tuning) => set({ tuning }),
      isGerman: false,
      setIsGerman: (isGerman) => set({ isGerman }),
      language: '',
      setLanguage: (language) => set({ language }),
      userBooks: [],
      addUserBook: (title) =>
        set((state) => ({
          userBooks: [
            ...state.userBooks,
            { id: crypto.randomUUID(), title, songs: [] },
          ],
        })),
      importUserBook: (title, songs, sourceId) =>
        set((state) => ({
          userBooks: [
            ...state.userBooks,
            { id: crypto.randomUUID(), title, songs, sourceId },
          ],
        })),
      removeUserBook: (bookId) =>
        set((state) => ({
          userBooks: state.userBooks.filter((b) => b.id !== bookId),
        })),
      renameUserBook: (bookId, title) =>
        set((state) => ({
          userBooks: state.userBooks.map((b) =>
            b.id === bookId ? { ...b, title } : b
          ),
        })),
      addSongToBook: (bookId, song) =>
        set((state) => ({
          userBooks: state.userBooks.map((b) =>
            b.id === bookId ? { ...b, songs: [...b.songs, song] } : b
          ),
        })),
      removeSongFromBook: (bookId, songId) =>
        set((state) => ({
          userBooks: state.userBooks.map((b) =>
            b.id === bookId
              ? { ...b, songs: b.songs.filter((s) => s.id !== songId) }
              : b
          ),
        })),
      renameSongInBook: (bookId, songId, title) =>
        set((state) => ({
          userBooks: state.userBooks.map((b) =>
            b.id === bookId
              ? {
                  ...b,
                  songs: b.songs.map((s) =>
                    s.id === songId ? { ...s, title } : s
                  ),
                }
              : b
          ),
        })),
      updateSongAbc: (bookId, songId, abc) =>
        set((state) => ({
          userBooks: state.userBooks.map((b) =>
            b.id === bookId
              ? {
                  ...b,
                  songs: b.songs.map((s) =>
                    s.id === songId ? { ...s, abc } : s
                  ),
                }
              : b
          ),
        })),
      updateSongTempo: (bookId, songId, tempo) =>
        set((state) => ({
          userBooks: state.userBooks.map((b) =>
            b.id === bookId
              ? {
                  ...b,
                  songs: b.songs.map((s) =>
                    s.id === songId ? { ...s, tempo } : s
                  ),
                }
              : b
          ),
        })),
    }),
    {
      name: 'fluyten-settings',
      ...(import.meta.env.MODE === 'test' && {
        storage: createJSONStorage(() => ({
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        })),
      }),
    }
  )
);
