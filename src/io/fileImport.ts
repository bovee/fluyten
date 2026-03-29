import { parseAbcFile } from './abcImport';
import { toAbc, notesToAbc } from './abcExport';
import type { Music } from '../music';
import type { UserSong } from '../store';

export function isMusicXmlPath(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower.endsWith('.musicxml') ||
    lower.endsWith('.xml') ||
    lower.endsWith('.mxl')
  );
}

export function isMidiPath(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith('.mid') || lower.endsWith('.midi');
}

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`HTTP error ${status}`);
    this.status = status;
  }
}

/**
 * Convert an array of Music objects (one per MIDI channel) to a single ABC
 * string.  Single-voice files produce plain ABC; multi-voice files produce
 * ABC with V: headers, one per voice.
 */
function musicVoicesToAbc(voices: Music[]): string {
  if (voices.length === 1) return `X:1\n${toAbc(voices[0])}`;
  const first = voices[0];
  const header = [
    first.title ? `T:${first.title}` : null,
    `M:${first.signatures[0].beatsPerBar}/${first.signatures[0].beatValue}`,
    'L:1/8',
    `K:${first.signatures[0].keySignature}`,
  ]
    .filter(Boolean)
    .join('\n');
  const voiceParts = voices
    .map((m, i) => `V:${i + 1}\n${notesToAbc(m, m.signatures[0].keySignature)}`)
    .join('\n');
  return `X:1\n${header}\n${voiceParts}`;
}

/** Shared format routing used by both parseSongsFromFile and parseSongsFromUrl. */
async function parseSongsFromContent(
  content: string | ArrayBuffer,
  path: string,
  fallbackTitle: string
): Promise<UserSong[]> {
  const lower = path.toLowerCase();

  if (content instanceof ArrayBuffer) {
    if (isMidiPath(lower)) {
      const { fromMidi } = await import('./midiImport');
      const voices = fromMidi(content);
      const title = voices[0]?.title || fallbackTitle;
      return [
        { id: crypto.randomUUID(), title, abc: musicVoicesToAbc(voices) },
      ];
    }
    if (lower.endsWith('.mxl')) {
      const { fromMusicXml, extractMxl } = await import('./musicXmlImport');
      const xmlText = extractMxl(content);
      const music = fromMusicXml(xmlText);
      return [
        {
          id: crypto.randomUUID(),
          title: music.title || fallbackTitle,
          abc: `X:1\n${toAbc(music)}`,
        },
      ];
    }
    throw new Error(`Binary import not supported for: ${path}`);
  }

  if (isMusicXmlPath(lower)) {
    const { fromMusicXml } = await import('./musicXmlImport');
    const music = fromMusicXml(content);
    return [
      {
        id: crypto.randomUUID(),
        title: music.title || fallbackTitle,
        abc: `X:1\n${toAbc(music)}`,
      },
    ];
  }

  return parseAbcFile(content).map(({ title, abc }) => ({
    id: crypto.randomUUID(),
    title: title === 'Untitled' ? fallbackTitle : title,
    abc,
  }));
}

/**
 * Parse a File into UserSong objects.
 * Handles .abc/.txt, .musicxml/.xml/.mxl, and .mid/.midi.
 * Throws on parse failure.
 */
export async function parseSongsFromFile(file: File): Promise<UserSong[]> {
  const fallbackTitle = file.name.replace(/\.[^.]+$/, '');
  const lower = file.name.toLowerCase();
  let content: string | ArrayBuffer;
  if (isMidiPath(lower) || lower.endsWith('.mxl')) {
    content = await file.arrayBuffer();
  } else {
    content = await file.text();
  }
  return parseSongsFromContent(content, file.name, fallbackTitle);
}

/**
 * Fetch a URL and parse its content into UserSong objects.
 * Handles .abc/.txt, .musicxml/.xml/.mxl, and .mid/.midi.
 * Throws HttpError on non-2xx responses; rethrows network failures as-is.
 */
export async function parseSongsFromUrl(url: string): Promise<UserSong[]> {
  const response = await fetch(url);
  if (!response.ok) throw new HttpError(response.status);

  const urlPath = new URL(url).pathname;
  const fallbackTitle = (
    urlPath.split('/').pop()?.split('?')[0] ?? 'Imported'
  ).replace(/\.[^.]+$/, '');

  const lower = urlPath.toLowerCase();
  let content: string | ArrayBuffer;
  if (isMidiPath(lower) || lower.endsWith('.mxl')) {
    content = await response.arrayBuffer();
  } else {
    content = await response.text();
  }
  return parseSongsFromContent(content, urlPath, fallbackTitle);
}
