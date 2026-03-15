import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import rtlPlugin from 'stylis-plugin-rtl';
import { prefixer } from 'stylis';
import { type Song } from './songs';
import { IndexPage } from './IndexPage';
import { SongPage } from './SongPage';
import { useStore } from './store';

import { RTL_LANGUAGES } from './i18n';
import './App.css';

const cacheLtr = createCache({ key: 'css' });
const cacheRtl = createCache({
  key: 'css-rtl',
  stylisPlugins: [prefixer, rtlPlugin],
});

interface SelectedSong {
  song: Song;
  readOnly: boolean;
  bookId?: string;
}

function App() {
  const { i18n } = useTranslation();
  const isRtl = RTL_LANGUAGES.has(i18n.resolvedLanguage ?? i18n.language);
  const theme = createTheme({
    direction: isRtl ? 'rtl' : 'ltr',
    palette: { primary: { main: '#4a6272' } },
    components: {
      MuiAccordion: {
        defaultProps: {
          slots: { heading: 'h2' },
        },
      },
    },
  });

  const [selected, setSelected] = useState<SelectedSong | null>(null);
  const [expandedBook, setExpandedBook] = useState<string | false>(false);
  const updateSongAbc = useStore((state) => state.updateSongAbc);
  const updateSongTempo = useStore((state) => state.updateSongTempo);
  const renameSongInBook = useStore((state) => state.renameSongInBook);

  const handleSelectSong = (song: Song, readOnly: boolean, bookId?: string) => {
    setSelected({ song, readOnly, bookId });
  };

  if (selected) {
    const { song, readOnly, bookId } = selected;
    const onAbcChange = bookId
      ? (abc: string) => {
          updateSongAbc(bookId, song.id, abc);
          const titleMatch = abc.match(/^T:\s*(.+)/m);
          if (titleMatch) renameSongInBook(bookId, song.id, titleMatch[1].trim());
        }
      : undefined;
    const onTempoChange = bookId
      ? (tempo: number) => updateSongTempo(bookId, song.id, tempo)
      : undefined;
    return (
      <CacheProvider value={isRtl ? cacheRtl : cacheLtr}>
        <ThemeProvider theme={theme}>
          <SongPage
            song={song}
            onBack={() => setSelected(null)}
            readOnly={readOnly}
            onAbcChange={onAbcChange}
            onTempoChange={onTempoChange}
          />
        </ThemeProvider>
      </CacheProvider>
    );
  }

  return (
    <CacheProvider value={isRtl ? cacheRtl : cacheLtr}>
      <ThemeProvider theme={theme}>
        <IndexPage
          expandedBook={expandedBook}
          onExpandedBookChange={setExpandedBook}
          onSelectSong={(song, readOnly, bookId) =>
            handleSelectSong(song, readOnly, bookId)
          }
        />
      </ThemeProvider>
    </CacheProvider>
  );
}

export default App;
