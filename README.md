# Fluyten

A free, open-source web app for learning and practicing recorder music.

**[Try it now at bovee.github.io/fluyten](https://bovee.github.io/fluyten/)**

## What it does

Fluyten shows you sheet music, listens to you play through your microphone, and highlights each note green as you play it correctly. It also plays back pieces so you can hear how they should sound.

## Features

**Practice with real-time feedback**
- Listens via your microphone and tracks which notes you play correctly
- Highlights notes green as you progress through a piece
- Adjustable tempo for playing at your own speed
- Built-in metronome

**Sheet music rendering**
- Renders standard music notation from [ABC notation](https://abcnotation.com/wiki/abc:standard:v2.1)
- Supports key signatures, time signatures, accidentals, decorations, lyrics, repeat bars, and multi-voice parts
- Tap any note to see its fingering diagram

**Recorder support**
- Soprano, sopranino, alto, tenor, and bass recorders
- Baroque and German fingering diagrams
- Auto-detect wizard that identifies your recorder type and fingering system from mic input
- Adjustable tuning ratio for instruments not at A=440 Hz

**Song management**
- Organize songs into books (collections)
- Built-in beginner song library
- Import songs from ABC files, MusicXML files, or URLs
- Drag and drop files directly into the app
- Export books as ABC files
- Inline ABC notation editor with live preview

**Music tools**
- Scale generator (any key, major/minor, ascending/descending/both, one octave or full instrument range)
- Note transformations: transpose by octave, fifth, or semitone; double or halve durations; simplify or add accidentals

**Multilingual**
- Available in 14 languages: English, Arabic, Bengali, Chinese (Simplified), French, German, Hindi, Indonesian, Japanese, Korean, Portuguese, Russian, Spanish, and Urdu
- Full right-to-left support for Arabic and Urdu

## Running locally

You need [Node.js](https://nodejs.org/) 18+ and a microphone.

```bash
npm install
npm run dev
```

Open `https://localhost:5173`. The dev server uses a self-signed certificate (HTTPS is required for microphone access), so accept the browser's security warning.

## Contributing

Contributions are welcome! Please open an issue or pull request on [GitHub](https://github.com/bovee/fluyten).

Before submitting:
1. `npm run build` and `npm test` should both pass
2. `npm run lint` should report no issues
3. Add tests for new functionality where practical

## License

MIT -- see [LICENSE](./LICENSE).
