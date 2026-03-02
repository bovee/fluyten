# Fluyten

A web app for learning and practicing recorder music. Fluyten parses [ABC notation](https://abcnotation.com/wiki/abc:standard:v2.1), renders sheet music, tracks notes you play via microphone, and can play back pieces with a metronome.

**[Live demo](https://bovee.github.io/fluyten/)**

## Features

- Renders sheet music from ABC notation using [VexFlow](https://www.vexflow.com/)
- Listens to your recorder via microphone and highlights notes as you play
- Tracks your progress through a piece (how many notes played correctly in sequence)
- Plays back music with a built-in synthesizer and metronome
- Supports soprano, alto, tenor, bass, and sopranino recorders
- Adjustable tuning ratio (for recorders not at A=440 Hz)
- Baroque and German fingering diagrams
- Import/export songs as ABC notation files
- Built-in library of practice pieces
- Scale generator
- Multilingual UI (English, Arabic, Bengali, French, German, Hindi, Indonesian, Japanese, Korean, Portuguese, Russian, Spanish, Urdu, Chinese)

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- A microphone (for note detection)

### Install & run

```bash
npm install
npm run dev
```

The app runs at `https://localhost:5173` (HTTPS is required for microphone access).

> **Note:** The dev server uses a self-signed certificate. Your browser will warn you about this — accept the exception to proceed.

## Development

```bash
npm run dev          # Start dev server
npm run build        # TypeScript check + production build
npm run test         # Run all tests (Vitest)
npm run test:ui      # Interactive test UI
npm run test:coverage  # Tests with coverage report
npm run lint         # ESLint
npm run format       # Prettier (formats src/)
npm run storybook    # Storybook dev server (port 6006)
```

To run a single test file:

```bash
npx vitest run src/abc.test.ts
```

### Project structure

| Path | Description |
|------|-------------|
| `src/abc.ts` | ABC notation parser — entry point `fromAbc()` |
| `src/music.ts` | Core data models: `Note`, `Music`, `BarLine`, `Decoration` |
| `src/constants.ts` | MIDI/frequency mappings, VexFlow duration/pitch maps |
| `src/FrequencyTracker.ts` | Microphone input → FFT → MIDI pitch detection |
| `src/NotePlayer.ts` | Web Audio API synthesizer and metronome |
| `src/Vexflow.tsx` | React component that renders `Music` to sheet music |
| `src/store.ts` | Zustand store (persisted to localStorage) |
| `src/instrument.ts` | Recorder type definitions and frequency ranges |

### Architecture

```
ABC text  →  fromAbc()  →  Music object  →  Vexflow (render)
                                         →  NotePlayer (playback)
Microphone  →  FrequencyTracker  →  MIDI pitch  →  App state
```

### Testing

Tests live alongside source files (e.g. `src/abc.test.ts`). The test suite runs in two projects:

- **normal** — unit tests with happy-dom
- **storybook** / **visual** — browser tests via Playwright (screenshot regression)

## Contributing

Contributions are welcome! Please open an issue or pull request on GitHub.

When submitting a pull request:
1. Run `npm run build` and `npm test` to ensure everything passes
2. Run `npm run lint` to check for style issues
3. Add tests for new functionality where practical

## License

MIT — see [LICENSE](./LICENSE).
