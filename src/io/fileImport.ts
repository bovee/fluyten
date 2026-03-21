import { parseAbcFile } from './abcImport';
import { toAbc } from './abcExport';

import { fromMusicXml, extractMxl } from './musicXmlImport';
import { fromMidiToAbc } from './midiImport';
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

/**
 * Parse a File into UserSong objects.
 * Handles .abc/.txt, .musicxml/.xml/.mxl, and .mid/.midi.
 * Throws on parse failure.
 */
export async function parseSongsFromFile(file: File): Promise<UserSong[]> {
  const name = file.name.toLowerCase();
  const fallbackTitle = file.name.replace(/\.[^.]+$/, '');

  if (isMidiPath(name)) {
    const buffer = await file.arrayBuffer();
    const { title, abc } = fromMidiToAbc(buffer);
    return [{ id: crypto.randomUUID(), title: title || fallbackTitle, abc }];
  }

  if (isMusicXmlPath(name)) {
    let xmlText: string;
    if (name.endsWith('.mxl')) {
      const buffer = await file.arrayBuffer();
      xmlText = extractMxl(buffer);
    } else {
      xmlText = await file.text();
    }
    const music = fromMusicXml(xmlText);
    return [
      {
        id: crypto.randomUUID(),
        title: music.title || fallbackTitle,
        abc: `X:1\n${toAbc(music)}`,
      },
    ];
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      resolve(
        parseAbcFile(text).map(({ title, abc }) => ({
          id: crypto.randomUUID(),
          title: title === 'Untitled' ? fallbackTitle : title,
          abc,
        }))
      );
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Parse already-fetched text content into UserSong objects.
 * pathForExtension is the file name or URL path, used to detect MusicXML vs ABC.
 */
export function parseSongsFromText(
  text: string,
  pathForExtension: string,
  fallbackTitle: string
): UserSong[] {
  if (isMusicXmlPath(pathForExtension)) {
    const music = fromMusicXml(text);
    return [
      {
        id: crypto.randomUUID(),
        title: music.title || fallbackTitle,
        abc: `X:1\n${toAbc(music)}`,
      },
    ];
  }
  return parseAbcFile(text).map(({ title, abc }) => ({
    id: crypto.randomUUID(),
    title: title === 'Untitled' ? fallbackTitle : title,
    abc,
  }));
}

/**
 * Parse already-fetched binary content into UserSong objects.
 * Used for MIDI URL imports where the response must be read as ArrayBuffer.
 */
export function parseSongsFromBuffer(
  buffer: ArrayBuffer,
  pathForExtension: string,
  fallbackTitle: string
): UserSong[] {
  if (isMidiPath(pathForExtension)) {
    const { title, abc } = fromMidiToAbc(buffer);
    return [{ id: crypto.randomUUID(), title: title || fallbackTitle, abc }];
  }
  throw new Error(`Binary import not supported for: ${pathForExtension}`);
}
