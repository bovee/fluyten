# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## About

Fluyten is a React + TypeScript web app for learning and practicing recorder music. It parses ABC notation, renders sheet music via VexFlow, tracks played notes via microphone, and can play back music. Deployed at https://bovee.github.io/fluyten/.

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

Core data flow: **ABC text → `Music` object → VexFlow rendering / audio playback**

### Data model and I/O (`src/io/`, `src/music.ts`)

- **`src/music.ts`** — Core data models: `Note`, `Music`, `BarLine`, `Decoration`, `Duration`, `KEYS`. The `Music` class holds notes, key/time signatures, bar lines, beams, curves (ties/slurs), lyrics, and clef. `Note` stores MIDI pitches, accidentals, decorations, and duration. `Music.reflow()` recalculates bar lines from time signature.
- **`src/io/abcImport.ts`** — Parses [ABC notation](https://abcnotation.com/wiki/abc:standard:v2.1) into `Music` objects. Key functions: `fromAbc()` (main entry), `voicesFromAbc()` (multi-voice), `splitTunes()` (multi-tune files), `parseFragment()` (for transformations). Supports `w:` aligned lyrics (multi-verse), `W:` unaligned lyrics, `clef=`, `middle=` pitch adjustment, grace notes, decorations, repeats, voltas, tuplets, chords, ties, and slurs.
- **`src/io/abcExport.ts`** — Serializes `Music` objects back to ABC notation. Key functions: `toAbc()` (full round-trip with headers), `notesToAbc()` (score only), `reflowAbc()` (reflow and re-export). Exports `w:` and `W:` lyrics.
- **`src/io/musicXmlImport.ts`** — Converts MusicXML to ABC notation string, which is then parsed by `fromAbc()`.
- **`src/io/fileImport.ts`** — Handles file reading: detects ABC vs MusicXML (including compressed `.mxl` via fflate), returns ABC text.
- **`src/io/transformations.ts`** — Note transformations applied to selected fragments: transpose (octave, fifth, semitone), duration scaling, accidental simplification/expansion. Uses `parseFragment()` → apply → `notesToAbc()`.
- **`src/constants.ts`** — Shared constants: `PITCH_CONSTANTS` (MIDI/frequency mappings, `OCTAVE_OFFSET = 24`), `DURATION_TICKS`, time signatures. The OCTAVE_OFFSET means: `MIDI_pitch = 24 + octave * 12 + semitone`, where octave 3 = uppercase ABC notes (C4–B4), octave 4 = lowercase (C5–B5).

### Audio (`src/audio/`)

- **`src/audio/FrequencyTracker.ts`** — Captures mic input via `getUserMedia`, runs FFT analysis, uses Gaussian fitting (fmin library) to detect fundamental frequency, fires `onStartNote`/`onStopNote` callbacks with MIDI pitch values.
- **`src/audio/NotePlayer.ts`** — Synthesizes audio using Web Audio API oscillators (sawtooth wave). Schedules notes from a `Music` object and runs an independent metronome. Supports multi-voice playback with separate volume for selected/unselected voices.
- **`src/audio/RecorderDetector.ts`** — Two-step mic-based setup wizard: detects recorder type (step 1) and German/baroque fingering (step 2).

### Rendering

- **`src/Vexflow.tsx`** — React component that converts `Music` → VexFlow `StaveNote`s and renders SVG sheet music. Handles multi-bar line wrapping, key/time signatures, accidentals, grace notes, decorations (dynamics, articulations, ornaments, breath marks), ties, slurs, tuplets, voltas, repeat bars, lyrics (as `Annotation` modifiers below notes), and cursor tracking. Notes highlight green as they're played. Clicking a note opens a popover with its name and fingering diagram.
- **`src/FingeringDiagram.tsx`** — SVG component rendering recorder fingering diagrams. Supports baroque and German systems, trill fingerings, and all 6 recorder types.

### UI pages and dialogs

- **`src/App.tsx`** — Root component; URL hash routing between `IndexPage` and `SongPage`.
- **`src/IndexPage.tsx`** — Home screen: song books in accordion UI, drag-and-drop file import, URL import, create/delete/export books and songs.
- **`src/SongPage.tsx`** — Per-song view: sheet music, SpeedDial (record/play/metronome), tempo control, voice selection, ABC editor drawer.
- **`src/EditorDrawer.tsx`** — Inline ABC notation editor with live error feedback.
- **`src/SettingsDialog.tsx`** — Instrument type, tuning ratio, German/baroque toggle, language selection.
- **`src/scales/ScaleDialog.tsx`** — Scale exercise generator (key, mode, range, direction).
- **`src/OnboardingDialog.tsx`** — First-run wizard: language + recorder type selection.

### State and config

- **`src/store.ts`** — Zustand store persisted to localStorage (`"fluyten-settings"`). Holds: `tempo`, `instrumentType`, `tuning`, `isGerman`, `language`, and `userBooks` (user-created song collections).
- **`src/instrument.ts`** — Defines the 6 recorder types (`RECORDER_TYPES`) with their frequency ranges.
- **`src/songs.ts`** — Built-in song books and `Song`/`BuiltInBook` types.
- **`src/i18n.ts`** — i18next setup with 14 languages; locale files in `src/locales/<lang>/translation.json`. RTL languages (`ar`, `ur`) are tracked in `RTL_LANGUAGES`.

### Testing

Tests live alongside source files (e.g. `src/music.test.ts`). `src/test/audioMocks.ts` provides Web Audio API mocks, loaded via `src/test/setup.ts`. Vitest runs two projects: `"normal"` (unit tests with happy-dom) and `"storybook"` (browser tests via Playwright).

When adding i18n strings, add them to all 14 locale files in `src/locales/`. The English file (`en/translation.json`) is the source of truth.
