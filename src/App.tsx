import { lazy, Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import rtlPlugin from 'stylis-plugin-rtl';
import { prefixer } from 'stylis';
import { type Song } from './music';
import { IndexPage } from './IndexPage';
import { OnboardingDialog } from './OnboardingDialog';
import { SetPage } from './SetPage';
import { useStore, type UserSet } from './store';
import { RTL_LANGUAGES } from './i18n';
import { createAppTheme } from './theme';

const SongPage = lazy(() =>
  import('./SongPage').then((m) => ({ default: m.SongPage }))
);
import './App.css';

const cacheLtr = createCache({ key: 'css' });
const cacheRtl = createCache({
  key: 'css-rtl',
  stylisPlugins: [prefixer, rtlPlugin],
});

interface SelectedSong {
  song: Song;
  readOnly: boolean;
  setSongs?: Song[];
  setIndex?: number;
}

function App() {
  const { i18n } = useTranslation();
  const isRtl = RTL_LANGUAGES.has(i18n.resolvedLanguage ?? i18n.language);
  const colorMode = useStore((state) => state.colorMode);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const resolvedMode =
    colorMode === 'system' ? (prefersDark ? 'dark' : 'light') : colorMode;
  const theme = useMemo(
    () => createAppTheme(resolvedMode, isRtl),
    [resolvedMode, isRtl]
  );

  const onboarded = useStore((state) => state.onboarded);
  const setOnboarded = useStore((state) => state.setOnboarded);

  const [selected, setSelected] = useState<SelectedSong | null>(null);
  const [selectedSet, setSelectedSet] = useState<UserSet | null>(null);
  const updateSongAbc = useStore((state) => state.updateSongAbc);

  // Narrow the subscription: we only need the live copy of the selected set,
  // not the whole sets/songs arrays. Subscribing to the whole lists at App
  // level means every store mutation (practice results, settings) re-renders
  // the entire tree including Score.
  const liveSet = useStore((s) =>
    selectedSet ? (s.sets.find((ss) => ss.id === selectedSet.id) ?? null) : null
  );

  const selectedSongId = selected?.song.id;
  const selectedReadOnly = selected?.readOnly;
  const onAbcChange = useMemo(
    () =>
      selectedSongId && !selectedReadOnly
        ? (abc: string) => updateSongAbc(selectedSongId, abc)
        : undefined,
    [selectedSongId, selectedReadOnly, updateSongAbc]
  );

  if (selected) {
    const { song, readOnly, setSongs, setIndex } = selected;
    const hasStepping = setSongs !== undefined && setIndex !== undefined;
    const onPrevSong =
      hasStepping && setIndex > 0
        ? () =>
            setSelected({
              song: setSongs[setIndex - 1],
              readOnly,
              setSongs,
              setIndex: setIndex - 1,
            })
        : undefined;
    const onNextSong =
      hasStepping && setIndex < setSongs.length - 1
        ? () =>
            setSelected({
              song: setSongs[setIndex + 1],
              readOnly,
              setSongs,
              setIndex: setIndex + 1,
            })
        : undefined;
    return (
      <CacheProvider value={isRtl ? cacheRtl : cacheLtr}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Suspense fallback={null}>
            <SongPage
              key={song.id}
              song={song}
              onBack={() => setSelected(null)}
              readOnly={readOnly}
              onAbcChange={onAbcChange}
              onPrevSong={onPrevSong}
              onNextSong={onNextSong}
            />
          </Suspense>
        </ThemeProvider>
      </CacheProvider>
    );
  }

  if (liveSet) {
    return (
      <CacheProvider value={isRtl ? cacheRtl : cacheLtr}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <SetPage
            set={liveSet}
            onBack={() => setSelectedSet(null)}
            onSelectSong={(song, readOnly) => {
              const storeSongs = useStore.getState().songs;
              const setSongs = liveSet.songIds
                .map((id) => storeSongs.find((s) => s.id === id))
                .filter((s): s is NonNullable<typeof s> => s !== undefined);
              const setIndex = setSongs.findIndex((s) => s.id === song.id);
              setSelected({ song, readOnly, setSongs, setIndex });
            }}
          />
        </ThemeProvider>
      </CacheProvider>
    );
  }

  return (
    <CacheProvider value={isRtl ? cacheRtl : cacheLtr}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <OnboardingDialog open={!onboarded} onComplete={setOnboarded} />
        <IndexPage
          onSelectSong={(song, readOnly) => setSelected({ song, readOnly })}
          onSelectSet={setSelectedSet}
        />
      </ThemeProvider>
    </CacheProvider>
  );
}

export default App;
