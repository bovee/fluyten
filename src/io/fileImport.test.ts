import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isMusicXmlPath,
  parseSongsFromFile,
  parseSongsFromUrl,
  HttpError,
} from './fileImport';
import { fromMusicXml, extractMxl } from './musicXmlImport';
import { toAbc, notesToAbc } from './abcExport';
import { fromMidi } from './midiImport';

vi.mock('./musicXmlImport', () => ({
  fromMusicXml: vi.fn(() => ({ title: 'XML Song' })),
  extractMxl: vi.fn(() => '<score-partwise/>'),
}));

vi.mock('./abcExport', () => ({
  toAbc: vi.fn(() => 'T:XML Song\nK:C\nC D E F |'),
  notesToAbc: vi.fn(() => 'C D E F |'),
}));

vi.mock('./midiImport', () => ({
  fromMidi: vi.fn(() => [
    {
      title: 'MIDI Song',
      signatures: [
        { atNoteIndex: 0, keySignature: 'C', beatsPerBar: 4, beatValue: 4 },
      ],
      notes: [],
    },
  ]),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fromMusicXml).mockReturnValue({ title: 'XML Song' } as never);
  vi.mocked(extractMxl).mockReturnValue('<score-partwise/>');
  vi.mocked(toAbc).mockReturnValue('T:XML Song\nK:C\nC D E F |');
  vi.mocked(notesToAbc).mockReturnValue('C D E F |');
  vi.mocked(fromMidi).mockReturnValue([
    {
      title: 'MIDI Song',
      signatures: [
        { atNoteIndex: 0, keySignature: 'C', beatsPerBar: 4, beatValue: 4 },
      ],
      notes: [],
    } as never,
  ]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// isMusicXmlPath
// ---------------------------------------------------------------------------
describe('isMusicXmlPath', () => {
  it.each(['.xml', '.musicxml', '.mxl'])('returns true for %s', (ext) =>
    expect(isMusicXmlPath(`song${ext}`)).toBe(true)
  );

  it('is case-insensitive', () => {
    expect(isMusicXmlPath('Song.XML')).toBe(true);
    expect(isMusicXmlPath('Song.MusicXML')).toBe(true);
  });

  it.each(['.abc', '.txt', '.mid', ''])('returns false for %s', (ext) =>
    expect(isMusicXmlPath(`song${ext}`)).toBe(false)
  );
});

// ---------------------------------------------------------------------------
// parseSongsFromFile
// ---------------------------------------------------------------------------
describe('parseSongsFromFile', () => {
  it('parses an ABC .abc file', async () => {
    const file = new File(['X:1\nT:Test Song\nK:C\nC D E F |'], 'test.abc', {
      type: 'text/plain',
    });
    const songs = await parseSongsFromFile(file);
    expect(songs).toHaveLength(1);
    expect(songs[0].title).toBe('Test Song');
    expect(songs[0].abc).toContain('X:1');
    expect(songs[0].id).toBeTruthy();
  });

  it('parses a .txt file as ABC', async () => {
    const file = new File(
      ['X:1\nT:Text File Song\nK:G\nG A B c |'],
      'songs.txt'
    );
    const songs = await parseSongsFromFile(file);
    expect(songs[0].title).toBe('Text File Song');
  });

  it('uses filename (minus extension) as fallback title for ABC', async () => {
    const file = new File(['X:1\nK:C\nC'], 'my-piece.abc');
    const songs = await parseSongsFromFile(file);
    expect(songs[0].title).toBe('my-piece');
  });

  it('parses multiple tunes from one ABC file', async () => {
    const text = 'X:1\nT:First\nK:C\nC\n\nX:2\nT:Second\nK:G\nG';
    const file = new File([text], 'set.abc');
    const songs = await parseSongsFromFile(file);
    expect(songs).toHaveLength(2);
  });

  it('parses a .musicxml file via MusicXML parser', async () => {
    const file = new File(['<xml/>'], 'concerto.musicxml');
    const songs = await parseSongsFromFile(file);
    expect(songs).toHaveLength(1);
    expect(songs[0].title).toBe('XML Song');
    expect(songs[0].abc).toMatch(/^X:1\n/);
  });

  it('parses a .xml file via MusicXML parser', async () => {
    const file = new File(['<xml/>'], 'sonata.xml');
    const songs = await parseSongsFromFile(file);
    expect(songs).toHaveLength(1);
  });

  it('uses filename as fallback for MusicXML with no title', async () => {
    vi.mocked(fromMusicXml).mockReturnValueOnce({ title: '' } as never);
    const file = new File(['<xml/>'], 'nocturne.xml');
    const songs = await parseSongsFromFile(file);
    expect(songs[0].title).toBe('nocturne');
  });

  it('calls extractMxl for .mxl files', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'piece.mxl');
    await parseSongsFromFile(file);
    expect(vi.mocked(extractMxl)).toHaveBeenCalled();
  });

  it('each parsed song gets a unique id', async () => {
    const text = 'X:1\nT:A\nK:C\nC\n\nX:2\nT:B\nK:C\nD';
    const file = new File([text], 'tunes.abc');
    const songs = await parseSongsFromFile(file);
    expect(songs[0].id).not.toBe(songs[1].id);
  });

  it('parses a .mid file via fromMidi', async () => {
    const file = new File([new Uint8Array([0x4d, 0x54])], 'song.mid');
    const songs = await parseSongsFromFile(file);
    expect(vi.mocked(fromMidi)).toHaveBeenCalled();
    expect(songs).toHaveLength(1);
    expect(songs[0].title).toBe('MIDI Song');
  });

  it('uses fallback title when MIDI Music has no title', async () => {
    vi.mocked(fromMidi).mockReturnValueOnce([
      {
        title: '',
        signatures: [
          { atNoteIndex: 0, keySignature: 'C', beatsPerBar: 4, beatValue: 4 },
        ],
        notes: [],
      } as never,
    ]);
    const file = new File([new Uint8Array([0])], 'my-piece.mid');
    const songs = await parseSongsFromFile(file);
    expect(songs[0].title).toBe('my-piece');
  });

  it('assembles multi-voice ABC with V: lines for multi-channel MIDI', async () => {
    const voice1 = {
      title: 'Multi',
      signatures: [
        { atNoteIndex: 0, keySignature: 'C', beatsPerBar: 4, beatValue: 4 },
      ],
      notes: [],
    };
    const voice2 = {
      title: 'Multi',
      signatures: [
        { atNoteIndex: 0, keySignature: 'C', beatsPerBar: 4, beatValue: 4 },
      ],
      notes: [],
    };
    vi.mocked(fromMidi).mockReturnValueOnce([voice1, voice2] as never);
    const file = new File([new Uint8Array([0])], 'multi.mid');
    const songs = await parseSongsFromFile(file);
    expect(songs[0].abc).toContain('V:1');
    expect(songs[0].abc).toContain('V:2');
    // notesToAbc used instead of toAbc for multi-voice
    expect(vi.mocked(notesToAbc)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(toAbc)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// parseSongsFromUrl
// ---------------------------------------------------------------------------
describe('parseSongsFromUrl', () => {
  function stubFetch(body: string | ArrayBuffer, ok = true, status = 200) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok,
        status,
        text: () => Promise.resolve(body as string),
        arrayBuffer: () => Promise.resolve(body as ArrayBuffer),
      })
    );
  }

  it('fetches and parses an ABC URL', async () => {
    stubFetch('X:1\nT:My Tune\nK:C\nC D E F |');
    const songs = await parseSongsFromUrl('https://example.com/tune.abc');
    expect(songs).toHaveLength(1);
    expect(songs[0].title).toBe('My Tune');
    expect(songs[0].abc).toContain('X:1');
  });

  it('parses a multi-tune ABC URL into multiple songs', async () => {
    stubFetch('X:1\nT:Song A\nK:C\nC\n\nX:2\nT:Song B\nK:G\nG');
    const songs = await parseSongsFromUrl('https://example.com/tunes.abc');
    expect(songs).toHaveLength(2);
    expect(songs[0].title).toBe('Song A');
    expect(songs[1].title).toBe('Song B');
  });

  it('routes .musicxml URL to MusicXML parser', async () => {
    stubFetch('<xml/>');
    const songs = await parseSongsFromUrl('https://example.com/piece.musicxml');
    expect(songs).toHaveLength(1);
    expect(songs[0].title).toBe('XML Song');
    expect(songs[0].abc).toMatch(/^X:1\n/);
  });

  it('routes .xml URL to MusicXML parser', async () => {
    stubFetch('<xml/>');
    const songs = await parseSongsFromUrl('https://example.com/piece.xml');
    expect(vi.mocked(fromMusicXml)).toHaveBeenCalled();
    expect(songs).toHaveLength(1);
  });

  it('derives fallback title from URL path', async () => {
    vi.mocked(fromMusicXml).mockReturnValueOnce({ title: '' } as never);
    stubFetch('<xml/>');
    const songs = await parseSongsFromUrl('https://example.com/nocturne.xml');
    expect(songs[0].title).toBe('nocturne');
  });

  it('throws HttpError on non-2xx response', async () => {
    stubFetch('Not Found', false, 404);
    await expect(
      parseSongsFromUrl('https://example.com/missing.abc')
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('HttpError carries the HTTP status code', async () => {
    stubFetch('Server Error', false, 503);
    let err: unknown;
    try {
      await parseSongsFromUrl('https://example.com/missing.abc');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(503);
  });

  it('propagates network failures as-is', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    );
    await expect(
      parseSongsFromUrl('https://example.com/tune.abc')
    ).rejects.toThrow('Failed to fetch');
  });

  it('each song gets a unique id', async () => {
    stubFetch('X:1\nT:A\nK:C\nC\n\nX:2\nT:B\nK:C\nD');
    const songs = await parseSongsFromUrl('https://example.com/tunes.abc');
    expect(songs[0].id).not.toBe(songs[1].id);
  });
});
