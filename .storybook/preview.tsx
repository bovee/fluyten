import type { Preview } from '@storybook/react-vite';
import '../src/index.css';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import React, { useEffect } from 'react';
import { setupAudioMocks } from '../src/test/audioMocks';
import i18n, { RTL_LANGUAGES } from '../src/i18n';
import { useStore } from '../src/store';

setupAudioMocks();

const theme = createTheme({
  palette: {
    mode: 'light',
  },
  components: {
    MuiModal: {
      defaultProps: {
        container: () => document.getElementById('storybook-root') ?? document.body,
      },
    },
    MuiAccordion: {
      defaultProps: {
        slots: { heading: 'h2' },
      },
    },
  },
});

const LOCALES = [
  { value: 'en', title: 'English' },
  { value: 'fr', title: 'Français' },
  { value: 'es', title: 'Español' },
  { value: 'zh-Hans', title: '中文 (简体)' },
  { value: 'hi', title: 'हिन्दी' },
  { value: 'ar', title: 'العربية' },
];

const preview: Preview = {
  globalTypes: {
    locale: {
      description: 'Language',
      toolbar: {
        title: 'Language',
        icon: 'globe',
        items: LOCALES,
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    locale: 'en',
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'error',
      options: {
        // Only report confirmed violations; exclude 'incomplete' (inconclusive)
        // results such as "background colour could not be determined" on MUI
        // TextFields where overlapping elements prevent axe from resolving colour.
        resultTypes: ['violations'],
      },
      config: {
        rules: [
          {
            // MUI menus use <ul role="menu"> which overrides the implicit list
            // role, causing axe to flag <li> children (MenuItem, ListSubheader,
            // Divider) as orphaned list items. This is a known false positive for
            // the MUI menu pattern which is correctly accessible via ARIA roles.
            id: 'listitem',
            enabled: false,
          },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const locale = context.globals.locale ?? 'en';
      useEffect(() => {
        i18n.changeLanguage(locale);
        document.documentElement.dir = RTL_LANGUAGES.has(locale) ? 'rtl' : 'ltr';
      }, [locale]);
      // Default to onboarded so the OnboardingDialog doesn't block stories that
      // aren't specifically testing the onboarding flow.
      useStore.setState({ onboarded: true });
      return (
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Story />
        </ThemeProvider>
      );
    },
  ],
};

export default preview;
