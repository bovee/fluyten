import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isMusicXmlPath, parseSongsFromFile, parseSongsFromText } from './fileImport';
import { fromMusicXml, extractMxl } from './musicXmlImport';
import { toAbc } from './abcExport';

vi.mock('./musicXmlImport', () => ({
  fromMusicXml: vi.fn(() => ({ title: 'XML Song' })),
  extractMxl: vi.fn(() => '<score-partwise/>'),
}));

vi.mock('./abcExport', () => ({
  toAbc: vi.fn(() => 'T:XML Song\nK:C\nC D E F |'),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fromMusicXml).mockReturnValue({ title: 'XML Song' } as never);
  vi.mocked(extractMxl).mockReturnValue('<score-partwise/>');
  vi.mocked(toAbc).mockReturnValue('T:XML Song\nK:C\nC D E F |');
});

// ---------------------------------------------------------------------------
// isMusicXmlPath
// ---------------------------------------------------------------------------
describe('isMusicXmlPath', () => {
  it.each(['.xml', '.musicxml', '.mxl'])(
    'returns true for %s',
    (ext) => expect(isMusicXmlPath(`song${ext}`)).toBe(true)
  );

  it('is case-insensitive', () => {
    expect(isMusicXmlPath('Song.XML')).toBe(true);
    expect(isMusicXmlPath('Song.MusicXML')).toBe(true);
  });

  it.each(['.abc', '.txt', '.mid', ''])(
    'returns false for %s',
    (ext) => expect(isMusicXmlPath(`song${ext}`)).toBe(false)
  );
});

// ---------------------------------------------------------------------------
// parseSongsFromText
// ---------------------------------------------------------------------------
describe('parseSongsFromText', () => {
  it('parses a single-tune ABC string', () => {
    const songs = parseSongsFromText(
      'X:1\nT:My Tune\nK:C\nC D E F |',
      'tune.abc',
      'fallback'
    );
    expect(songs).toHaveLength(1);
    expect(songs[0].title).toBe('My Tune');
    expect(songs[0].abc).toContain('X:1');
  });

  it('parses a multi-tune ABC string into multiple songs', () => {
    const text = 'X:1\nT:Song A\nK:C\nC\n\nX:2\nT:Song B\nK:G\nG';
    const songs = parseSongsFromText(text, 'tunes.abc', 'fallback');
    expect(songs).toHaveLength(2);
    expect(songs[0].title).toBe('Song A');
    expect(songs[1].title).toBe('Song B');
  });

  it('routes .musicxml extension to MusicXML parser', () => {
    const songs = parseSongsFromText('<xml/>', 'piece.musicxml', 'fallback');
    expect(songs).toHaveLength(1);
    expect(songs[0].title).toBe('XML Song');
    expect(songs[0].abc).toMatch(/^X:1\n/);
  });

  it('routes .xml extension to MusicXML parser', () => {
    const songs = parseSongsFromText('<xml/>', 'piece.xml', 'fallback');
    expect(songs).toHaveLength(1);
  });

  it('uses fallbackTitle when MusicXML title is empty', () => {
    vi.mocked(fromMusicXml).mockReturnValueOnce({ title: '' } as never);
    const songs = parseSongsFromText('<xml/>', 'piece.xml', 'My Fallback');
    expect(songs[0].title).toBe('My Fallback');
  });

  it('each song gets a unique id', () => {
    const text = 'X:1\nT:A\nK:C\nC\n\nX:2\nT:B\nK:C\nD';
    const songs = parseSongsFromText(text, 'f.abc', '');
    expect(songs[0].id).not.toBe(songs[1].id);
  });
});

// ---------------------------------------------------------------------------
// parseSongsFromFile
// ---------------------------------------------------------------------------
describe('parseSongsFromFile', () => {
  it('parses an ABC .abc file', async () => {
    const file = new File(
      ['X:1\nT:Test Song\nK:C\nC D E F |'],
      'test.abc',
      { type: 'text/plain' }
    );
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
});
