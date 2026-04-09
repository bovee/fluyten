# Fluyten

A free, open-source web app for learning and practicing recorder music in 44 languages.
Fluyten:
 - Import sheet music in ABC, MIDI, and MusicXML formats
 - Supports simple editing operations and scale/arpeggio generation
 - Displays songs with a wide variety of supported decorations and musical notations
 - Will show fingerings for all pitches of recorder (Bass, Alto, Soprano, etc) with German system option.
 - Plays music, with accompaniment if available.
 - Can provide simple real-time feedback on your playing, with metronome.

**[Try it here](https://bovee.github.io/fluyten/)**

## License

[MIT licensed](./LICENSE).

## Running locally

You need [Node.js](https://nodejs.org/) 18+ and a microphone.

```bash
npm install
npm run dev
```

Open `https://localhost:5173`. The dev server uses a self-signed certificate (HTTPS is required for microphone access) so you will hhave to accept the browser's security warning.

## Contributing

Fluyten is worked on on a best-effort basis, but if you have an issue or feature request [please open it here](https://github.com/bovee/fluyten/issues/new).

Contributions are welcome! Please open a pull request on [GitHub](https://github.com/bovee/fluyten).

Before submitting:
1. `npm run build` and `npm test` should both pass.
2. `npm run format` should be used to conform to style.
3. `npm run lint` should report no issues.
5. Add tests for new functionality where practical. Visual tests may need to be updated with `npm run test:visual_update`.

## Extensions to the ABC format

Fluyten generally follows [the 2.1 spec for the ABC format](https://abcnotation.com/wiki/abc:standard:v2.1) with a few extensions:
 - `!...!` notation is case-insensitive (`!d.c.!` is handled alongside `!D.C.!`)
 - `!/!`, `!//!`, `!///!` or `!tremolo!`, `!////!` can be used for tremolos.
 - `!d.c.alfine!`, `!d.c.alcoda!`, `!alcoda!`, `!d.s.alfine!` and `!d.s.alcoda!` are supported for complex repetition patterns.
 - Several parts of the ABC spec are not supported: instructions (3.1.17), symbol lines (4.15), redefinable symbols (4.16), typesettings (6.1), macros (9), stylesheet directives (11), HTML special symbols (part of 14.1), etc

### Third-party assets

The [Bravura](https://www.steinberg.net/developers/) music font by Steinberg Media Technologies GmbH is included under the [SIL Open Font License 1.1](./public/OFL.txt) for use in music engraving.
