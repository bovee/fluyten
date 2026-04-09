# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## About

Fluyten is a React + TypeScript web app for learning and practicing recorder music. It parses ABC notation, renders sheet music via a custom SVG engraving engine, tracks played notes via microphone, and can play back music. Deployed at https://bovee.github.io/fluyten/.

## Commands

```bash
npm run dev          # Start dev server (Vite, HTTPS on localhost:5173)
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

Core data flow: **ABC text → `Music` object → SVG rendering (`engraving/`) / audio playback**

### Data model and I/O (`src/io/`, `src/music.ts`)

- **`src/music.ts`** — Core data models: `Note`, `Music`, `BarLine`, `Decoration`, `Duration`, `KEYS`. The `Music` class holds notes, key/time signatures, bar lines, beams, curves (ties/slurs), lyrics, and clef. `Note` stores MIDI pitches, accidentals, decorations, and duration. `Music.reflow()` recalculates bar lines from time signature.
- **`src/io/abcImport.ts`** — Parses [ABC notation](https://abcnotation.com/wiki/abc:standard:v2.1) into `Music` objects. Key functions: `fromAbc()` (main entry), `voicesFromAbc()` (multi-voice), `splitTunes()` (multi-tune files), `parseFragment()` (for transformations). Supports `w:` aligned lyrics (multi-verse), `W:` unaligned lyrics, `clef=`, `middle=` pitch adjustment, grace notes, decorations, repeats, voltas, tuplets, chords, ties, and slurs.
- **`src/io/abcExport.ts`** — Serializes `Music` objects back to ABC notation. Key functions: `toAbc()` (full round-trip with headers), `notesToAbc()` (score only), `reflowAbc()` (reflow and re-export). Exports `w:` and `W:` lyrics.
- **`src/io/musicXmlImport.ts`** — Converts MusicXML to ABC notation string, which is then parsed by `fromAbc()`.
- **`src/io/midiImport.ts`** — Converts MIDI files to `Music` objects.
- **`src/io/fileImport.ts`** — Handles file reading: detects ABC vs MusicXML (including compressed `.mxl` via fflate) vs MIDI (`.mid`/`.midi`), returns ABC text.
- **`src/io/transformations.ts`** — Note transformations applied to selected fragments: transpose (octave, fifth, semitone), duration scaling, accidental simplification/expansion. Uses `parseFragment()` → apply → `notesToAbc()`.
- **`src/constants.ts`** — Shared constants: `PITCH_CONSTANTS` (MIDI/frequency mappings, `OCTAVE_OFFSET = 24`), `DURATION_TICKS`, time signatures. The OCTAVE_OFFSET means: `MIDI_pitch = 24 + octave * 12 + semitone`, where octave 3 = uppercase ABC notes (C4–B4), octave 4 = lowercase (C5–B5).

### Audio (`src/audio/`)

- **`src/audio/FrequencyTracker.ts`** — Captures mic input via `getUserMedia`, uses the McLeod Pitch Method (MPM) via `mpm.ts` to detect fundamental frequency, fires `onStartNote`/`onStopNote` callbacks with MIDI pitch values.
- **`src/audio/SingleFrequencyTracker.ts`** — Lightweight tracker that detects whether a single target MIDI pitch is sounding; runs a narrow NSDF check on the main thread and offloads full MPM analysis to a Web Worker (`mpm.worker.ts`). Used by `RecorderDetector`.
- **`src/audio/mpm.ts`** / **`src/audio/mpm.worker.ts`** — McLeod Pitch Method implementation; the worker variant runs full-spectrum pitch detection off the main thread.
- **`src/audio/NotePlayer.ts`** — Synthesizes audio using Web Audio API oscillators (sawtooth wave). Schedules notes from a `Music` object and runs an independent metronome. Supports multi-voice playback with separate volume for selected/unselected voices.
- **`src/audio/RecorderDetector.ts`** — Two-step mic-based setup wizard: detects recorder type (step 1) and German/baroque fingering (step 2).

### Rendering (`src/engraving/`)

The app uses a custom SVG-based engraving engine (not VexFlow).

- **`src/engraving/Score.tsx`** — Top-level React component (`<Score>`). Converts `Music` → SVG sheet music. Handles multi-bar line wrapping, key/time signatures, accidentals, grace notes, decorations, ties, slurs, tuplets, voltas, repeat bars, lyrics, and cursor tracking. Notes highlight as they're played. Clicking a note opens a popover with its name and fingering diagram.
- **`src/engraving/layout/`** — Layout engine: `layoutEngine.ts` (orchestrates), `barAssignment.ts` (assigns notes to bars), `barSizing.ts` (calculates bar widths), `lineBreaking.ts` (wraps bars to lines), `measureLayout.ts` (positions notes within a bar), `pitchLayout.ts` (vertical note positions), `types.ts` (shared layout types).
- **`src/engraving/components/`** — SVG React components: `Bar`, `Barline`, `Beam`, `Cursor`, `Decoration`, `GraceNoteGroup`, `Lyrics`, `NoteGroup`, `StaffLines`, `TempoMark`, `CrossBarElements` (ties/slurs spanning bars).
- **`src/engraving/glyphs/`** — SMuFL music font glyph rendering (`Glyph.tsx`, `smufl.ts`).
- **`src/engraving/NoteNameDisplay.tsx`** / **`src/engraving/noteNameUtils.ts`** — Note name popover and pitch-name utilities.
- **`src/FingeringDiagram.tsx`** — SVG component rendering recorder fingering diagrams. Supports baroque and German systems, trill fingerings, and all 6 recorder types.

### UI pages and dialogs

- **`src/App.tsx`** — Root component; URL hash routing between `IndexPage` and `SongPage`.
- **`src/IndexPage.tsx`** — Home screen: song books in accordion UI, drag-and-drop file import, URL import, create/delete/export books and songs.
- **`src/SongPage.tsx`** — Per-song view: sheet music, SpeedDial (record/play/metronome), tempo control, voice selection, ABC editor drawer.
- **`src/EditorDrawer.tsx`** — Inline ABC notation editor with live error feedback.
- **`src/SettingsDialog.tsx`** — Instrument type, tuning ratio, German/baroque toggle, language selection.
- **`src/scales/GenerateNotesDialog.tsx`** — Exercise generator dialog with tabs for scales (key, mode, range, direction) and chords (`chordGenerator.ts`).
- **`src/OnboardingDialog.tsx`** — First-run wizard: language + recorder type selection.

### State and config

- **`src/store.ts`** — Zustand store persisted to localStorage (`"fluyten-settings"`). Holds: `tempo`, `instrumentType`, `tuning`, `isGerman`, `language`, and `userBooks` (user-created song collections).
- **`src/instrument.ts`** — Defines the 6 recorder types (`RECORDER_TYPES`) with their frequency ranges.
- **`src/songs.ts`** — Built-in song books and `Song`/`BuiltInBook` types.
- **`src/method.ts`** — Difficulty scoring for songs: defines `Technique` constants (note values, articulations, ornaments, etc.), `SongFeatures`, and `METHOD_DIFFICULTY` maps used to assign lesson-book difficulty levels to songs.
- **`src/i18n.ts`** — i18next setup with 14 languages; locale files in `src/locales/<lang>/translation.json`. RTL languages (`ar`, `ur`) are tracked in `RTL_LANGUAGES`.

### PWA / Service Worker

The app is a PWA. `public/manifest.webmanifest` holds the web app manifest (linked from `index.html`). The service worker is written in **`src/sw.ts`** using [Serwist](https://serwist.pages.dev/) and built by `@serwist/vite` (configured in `vite.config.ts`). It precaches all static assets plus the built-in ABC song files, and uses runtime caching for Google Fonts (StaleWhileRevalidate for stylesheets, CacheFirst with 1-year expiry for webfonts). The compiled SW is output to `dist/sw.js`.

### Testing

Tests live alongside source files (e.g. `src/music.test.ts`). `src/test/audioMocks.ts` provides Web Audio API mocks, loaded via `src/test/setup.ts`. Vitest runs two projects: `"normal"` (unit tests with happy-dom) and `"storybook"` (browser tests via Playwright).

When adding i18n strings, add them to all 14 locale files in `src/locales/`. The English file (`en/translation.json`) is the source of truth.
