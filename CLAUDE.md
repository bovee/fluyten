# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About

Fluyten is a React web app for learning and practicing recorder music. It parses ABC notation, renders sheet music via Vexflow, tracks played notes via microphone, and can play back music.

## Commands

```bash
npm run dev          # Start dev server (Vite)
npm run build        # TypeScript check + production build
npm run test         # Run all tests (Vitest)
npm run test:ui      # Interactive test UI
npm run test:coverage  # Tests with coverage
npm run lint         # ESLint
npm run format       # Prettier format (src/)
npm run storybook    # Storybook dev server (port 6006)
```

To run a single test file:
```bash
npx vitest run src/music.test.ts
```

## Architecture

The app's core data flow: **ABC text → `Music` object → VexFlow rendering / audio playback**

### Key domain modules

- **`src/io/abcImport.ts`** — Parses ABC notation into `Music` objects. Entry point: `fromAbc()`.
- **`src/io/abcExport.ts`** — Serializes `Music` objects back to ABC notation.
- **`src/music.ts`** — Core data models: `Note`, `Music`, `BarLine`, `Decoration`. The `Music` class holds notes, key/time signatures, bar lines, and beams.
- **`src/constants.ts`** — Shared constants: MIDI/frequency mappings, VexFlow duration/pitch maps, time signatures.
- **`src/songs.ts`** — Defines `Song`/`BuiltInBook` types and the built-in song books (e.g. `BUILT_IN_BOOKS`).
- **`src/scaleGenerator.ts`** — Generates scale exercises as ABC notation (`generateScaleAbc()`), respecting instrument range and direction.

### Audio

- **`src/FrequencyTracker.ts`** — Captures mic input via `getUserMedia`, runs FFT analysis, uses Gaussian fitting (`fmin` library) to detect the fundamental frequency, then fires `onStartNote`/`onStopNote` callbacks with MIDI pitch values.
- **`src/NotePlayer.ts`** — Synthesizes audio using Web Audio API oscillators (sawtooth wave for recorder timbre). Schedules notes from a `Music` object and runs an independent metronome.
- **`src/RecorderDetector.ts`** — Two-step mic-based setup wizard: detects which recorder type is being played (step 1) and whether it uses German or baroque fingering system (step 2). Fires callbacks via `DetectorCallbacks`.

### Rendering

- **`src/Vexflow.tsx`** — React component that converts a `Music` object to VexFlow `StaveNote`s and renders sheet music. Handles multi-bar line wrapping, accidentals, decorations, and highlights currently-played notes in green.
- **`src/FingeringDiagram.tsx`** — SVG component that renders recorder fingering diagrams for a given note. Supports baroque and German fingering systems via `lookupFingerings()`.

### State & UI

- **`src/store.ts`** — Zustand store persisted to localStorage (`"fluyten-settings"`). Holds: `tempo`, `instrumentType`, `tuning`, `isGerman`, and `userBooks` (user-created song collections).
- **`src/App.tsx`** — Root component; handles routing between `IndexPage` and `SongPage`.
- **`src/IndexPage.tsx`** — Home screen listing user song books (accordion UI). Supports creating, importing, exporting, and deleting books and songs. Opens `SettingsDialog` and `ScaleDialog`.
- **`src/SongPage.tsx`** — Per-song view; renders sheet music, wires `FrequencyTracker` and `NotePlayer`, and provides a SpeedDial for record/play/metronome. Includes an inline ABC editor drawer.
- **`src/SettingsDialog.tsx`** — MUI dialog for instrument type, tuning ratio (0.9–1.1), and German/baroque fingering toggle.
- **`src/ScaleDialog.tsx`** — MUI dialog for generating scale exercise books (key, range, direction selection).
- **`src/instrument.ts`** — Defines the 6 recorder types (`RECORDER_TYPES`) with their frequency ranges.
- **`src/i18n.ts`** — i18next setup with 14 languages; locale files live in `src/locales/`. RTL languages (`ar`, `ur`) are tracked in `RTL_LANGUAGES`.

### Testing

Tests live alongside source files (e.g. `src/music.test.ts`). `src/test/audioMocks.ts` provides Web Audio API mocks, loaded via `src/test/setup.ts`. Vitest runs two projects: `"normal"` (unit tests with happy-dom) and `"storybook"` (browser tests via Playwright).
