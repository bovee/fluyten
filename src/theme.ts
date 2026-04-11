import { createTheme, type ThemeOptions } from '@mui/material/styles';

const DARK_SHADOW =
  '0px 3px 10px rgba(255,255,255,0.15), 0px 1px 4px rgba(255,255,255,0.1)';

export function createAppTheme(mode: 'light' | 'dark', isRtl: boolean = false) {
  return createTheme({
    direction: isRtl ? 'rtl' : 'ltr',
    typography: {
      fontFamily: "'EB Garamond', Georgia, serif",
    },
    palette: {
      mode,
      primary: { main: mode === 'dark' ? '#6a8a9e' : '#4a6272' },
      ...(mode === 'dark'
        ? { text: { primary: '#d8d5d0' } }
        : { text: { disabled: 'rgba(0,0,0,0.55)' } }),
    },
    ...(mode === 'dark' && {
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
  });
}
