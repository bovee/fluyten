import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { type RecorderType } from './instrument';

export type PlaybackVoices = 'selected' | 'others' | 'all';
export type PracticeMode =
  | 'correct-then-advance'
  | 'in-tempo'
  | 'metronome-only';

export interface UserSong {
  id: string;
  title: string;
  abc: string;
  tempo?: number;
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
  playbackVoices: PlaybackVoices;
  setPlaybackVoices: (v: PlaybackVoices) => void;
  practiceMode: PracticeMode;
  setPracticeMode: (mode: PracticeMode) => void;
  playMetronome: boolean;
  setPlayMetronome: (v: boolean) => void;
  songs: UserSong[];
  addSong: (song: UserSong) => void;
  importSongs: (songs: UserSong[]) => void;
  removeSong: (songId: string) => void;
  renameSong: (songId: string, title: string) => void;
  updateSongAbc: (songId: string, abc: string) => void;
  updateSongTempo: (songId: string, tempo: number) => void;
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
      playbackVoices: 'selected',
      setPlaybackVoices: (playbackVoices) => set({ playbackVoices }),
      practiceMode: 'correct-then-advance',
      setPracticeMode: (practiceMode) => set({ practiceMode }),
      playMetronome: false,
      setPlayMetronome: (playMetronome) => set({ playMetronome }),
      songs: [],
      addSong: (song) => set((state) => ({ songs: [...state.songs, song] })),
      importSongs: (songs) =>
        set((state) => ({ songs: [...state.songs, ...songs] })),
      removeSong: (songId) =>
        set((state) => ({ songs: state.songs.filter((s) => s.id !== songId) })),
      renameSong: (songId, title) =>
        set((state) => ({
          songs: state.songs.map((s) =>
            s.id === songId ? { ...s, title } : s
          ),
        })),
      updateSongAbc: (songId, abc) =>
        set((state) => ({
          songs: state.songs.map((s) => (s.id === songId ? { ...s, abc } : s)),
        })),
      updateSongTempo: (songId, tempo) =>
        set((state) => ({
          songs: state.songs.map((s) =>
            s.id === songId ? { ...s, tempo } : s
          ),
        })),
    }),
    {
      name: 'fluyten-settings',
      version: 1,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version === 0 && Array.isArray(state.userBooks)) {
          state.songs = (
            state.userBooks as Array<{ songs?: UserSong[] }>
          ).flatMap((b) => b.songs ?? []);
          delete state.userBooks;
        }
        return state;
      },
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
