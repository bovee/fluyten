import { lazy, Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createTheme,
  ThemeProvider,
  type ThemeOptions,
} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import rtlPlugin from 'stylis-plugin-rtl';
import { prefixer } from 'stylis';
import { type Song } from './music';
import { IndexPage } from './IndexPage';
import { OnboardingDialog } from './OnboardingDialog';
import { useStore } from './store';
import { RTL_LANGUAGES } from './i18n';

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
}

function App() {
  const { i18n } = useTranslation();
  const isRtl = RTL_LANGUAGES.has(i18n.resolvedLanguage ?? i18n.language);
  const colorMode = useStore((state) => state.colorMode);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const resolvedMode =
    colorMode === 'system' ? (prefersDark ? 'dark' : 'light') : colorMode;
  const DARK_SHADOW =
    '0px 3px 10px rgba(255,255,255,0.15), 0px 1px 4px rgba(255,255,255,0.1)';
  const theme = useMemo(
    () =>
      createTheme({
        direction: isRtl ? 'rtl' : 'ltr',
        typography: {
          fontFamily: "'EB Garamond', Georgia, serif",
        },
        palette: {
          mode: resolvedMode,
          primary: { main: resolvedMode === 'dark' ? '#6a8a9e' : '#4a6272' },
          ...(resolvedMode === 'dark' && {
            text: { primary: '#d8d5d0' },
          }),
        },
        ...(resolvedMode === 'dark' && {
          shadows: Array.from({ length: 25 }, (_, i) =>
            i === 0 ? 'none' : DARK_SHADOW
          ) as ThemeOptions['shadows'],
        }),
        components: {
          MuiAccordion: {
            defaultProps: {
              slots: { heading: 'h2' },
            },
          },
        },
      }),
    [resolvedMode, isRtl]
  );

  const onboarded = useStore((state) => state.onboarded);
  const setOnboarded = useStore((state) => state.setOnboarded);

  const [selected, setSelected] = useState<SelectedSong | null>(null);
  const updateSongAbc = useStore((state) => state.updateSongAbc);

  if (selected) {
    const { song, readOnly } = selected;
    const onAbcChange = readOnly
      ? undefined
      : (abc: string) => updateSongAbc(song.id, abc);
    return (
      <CacheProvider value={isRtl ? cacheRtl : cacheLtr}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Suspense fallback={null}>
            <SongPage
              song={song}
              onBack={() => setSelected(null)}
              readOnly={readOnly}
              onAbcChange={onAbcChange}
            />
          </Suspense>
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
        />
      </ThemeProvider>
    </CacheProvider>
  );
}

export default App;
