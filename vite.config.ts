import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { serwist } from '@serwist/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/fluyten/',
  server: {
    // @ts-expect-error rolldown-vite types don't accept `true` but it works at runtime
    https: true,
  },
  plugins: [
    basicSsl(),
    react(),
    serwist({
      swSrc: 'src/sw.ts',
      swDest: 'sw.js',
      globDirectory: 'dist',
      injectionPoint: 'self.__SW_MANIFEST',
      rollupFormat: 'iife',
      // Cache the app shell and all static assets
      globPatterns: ['**/*.{js,css,html,woff,woff2,png,svg,ico}'],
      // Also cache the built-in ABC song files
      additionalPrecacheEntries: [
        { url: '/fluyten/beginner-songs-c.abc', revision: null },
        { url: '/fluyten/beginner-songs-f.abc', revision: null },
      ],
    }),
  ],
})
