import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { type RecorderType } from './instrument';
import { fromAbc, voicesFromAbc } from './io/abcImport';
import { featuresFromMusic, difficultyFromFeatures } from './method';

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
  beats?: number;
  difficulty?: string;
  practiceHistory?: number[];
  practiceCount?: number;
}

function derivedFields(
  abc: string,
  method: string
): Pick<UserSong, 'title' | 'beats' | 'difficulty'> {
  const music = fromAbc(abc);
  const title = music.title ?? '';
  const barCount = music.bars.filter((b) => b.type !== 'begin').length;
  const beats = barCount * music.signatures[0].beatsPerBar;
  const voices = voicesFromAbc(abc);
  const firstVoice = voices.length > 0 ? voices[0].music : music;
  const features = featuresFromMusic(firstVoice);
  const difficulty = difficultyFromFeatures(features, method);
  return { title, beats, difficulty };
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
  colorMode: 'system' | 'light' | 'dark';
  setColorMode: (mode: 'system' | 'light' | 'dark') => void;
  method: string;
  setMethod: (method: string) => void;
  tempo: number;
  setTempo: (tempo: number) => void;
  playbackVoices: PlaybackVoices;
  setPlaybackVoices: (v: PlaybackVoices) => void;
  practiceMode: PracticeMode;
  setPracticeMode: (mode: PracticeMode) => void;
  playMetronome: boolean;
  setPlayMetronome: (v: boolean) => void;
  autoScroll: boolean;
  setAutoScroll: (v: boolean) => void;
  practiceCalendar: Record<string, Record<number, number>>;
  recordPracticeSession: (songId: string, percentCorrect: number) => void;
  songs: UserSong[];
  addSongs: (songs: UserSong[]) => void;
  removeSong: (songId: string) => void;
  updateSongAbc: (songId: string, abc: string) => void;
  updateSongTempo: (songId: string, tempo: number) => void;
}

export const useStore = create<SettingsState>()(
  persist(
    (set) => ({
      onboarded: false,
      setOnboarded: () => set({ onboarded: true }),
      instrumentType: 'SOPRANO',
      setInstrumentType: (instrumentType) =>
        set({ instrumentType, method: 'none' }),
      tuning: 1.0,
      setTuning: (tuning) => set({ tuning }),
      isGerman: false,
      setIsGerman: (isGerman) => set({ isGerman }),
      language: '',
      setLanguage: (language) => set({ language }),
      colorMode: 'system',
      setColorMode: (colorMode) => set({ colorMode }),
      method: 'none',
      setMethod: (method) =>
        set((state) => ({
          method,
          songs: state.songs.map((s) => ({
            ...s,
            ...derivedFields(s.abc, method),
          })),
        })),
      tempo: 80,
      setTempo: (tempo) => set({ tempo }),
      playbackVoices: 'selected',
      setPlaybackVoices: (playbackVoices) => set({ playbackVoices }),
      practiceMode: 'correct-then-advance',
      setPracticeMode: (practiceMode) => set({ practiceMode }),
      playMetronome: false,
      setPlayMetronome: (playMetronome) => set({ playMetronome }),
      autoScroll: true,
      setAutoScroll: (autoScroll) => set({ autoScroll }),
      practiceCalendar: {},
      recordPracticeSession: (songId, percentCorrect) =>
        set((state) => {
          const today = new Date();
          const calKey = `${today.getFullYear()}-${today.getMonth() + 1}`;
          const day = today.getDate();
          return {
            practiceCalendar: {
              ...state.practiceCalendar,
              [calKey]: {
                ...state.practiceCalendar[calKey],
                [day]: (state.practiceCalendar[calKey]?.[day] ?? 0) + 1,
              },
            },
            songs: state.songs.map((s) =>
              s.id === songId
                ? {
                    ...s,
                    practiceHistory: [...(s.practiceHistory ?? []), percentCorrect].slice(-5),
                    practiceCount: (s.practiceCount ?? 0) + 1,
                  }
                : s
            ),
          };
        }),
      songs: [],
      addSongs: (songs) =>
        set((state) => ({
          songs: [
            ...state.songs,
            ...songs.map((s) => ({
              ...s,
              practiceHistory: s.practiceHistory ?? [],
              practiceCount: s.practiceCount ?? 0,
              ...derivedFields(s.abc, state.method),
            })),
          ],
        })),
      removeSong: (songId) =>
        set((state) => ({ songs: state.songs.filter((s) => s.id !== songId) })),
      updateSongAbc: (songId, abc) =>
        set((state) => ({
          songs: state.songs.map((s) =>
            s.id === songId
              ? { ...s, abc, ...derivedFields(abc, state.method) }
              : s
          ),
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
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version === 0 && Array.isArray(state.userBooks)) {
          state.songs = (
            state.userBooks as Array<{ songs?: UserSong[] }>
          ).flatMap((b) => b.songs ?? []);
          delete state.userBooks;
        }
        if (version < 2) {
          state.practiceCalendar = {};
          (state.songs as UserSong[]).forEach((s) => {
            s.practiceHistory = [];
            s.practiceCount = 0;
          });
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
