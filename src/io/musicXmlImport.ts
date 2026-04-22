import { unzipSync } from 'fflate';
import type { Accidental, BarLineType, Decoration, Signature } from '../music';
import { Duration, Music, Note } from '../music';

// Semitone offset for each diatonic step
const STEP_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

// Circle of fifths → key name (major)
const FIFTHS_TO_MAJOR_KEY: Record<number, string> = {
  '-7': 'Cb',
  '-6': 'Gb',
  '-5': 'Db',
  '-4': 'Ab',
  '-3': 'Eb',
  '-2': 'Bb',
  '-1': 'F',
  0: 'C',
  1: 'G',
  2: 'D',
  3: 'A',
  4: 'E',
  5: 'B',
  6: 'F#',
  7: 'C#',
};

// Circle of fifths → key name (minor)
const FIFTHS_TO_MINOR_KEY: Record<number, string> = {
  '-7': 'Abm',
  '-6': 'Ebm',
  '-5': 'Bbm',
  '-4': 'Fm',
  '-3': 'Cm',
  '-2': 'Gm',
  '-1': 'Dm',
  0: 'Am',
  1: 'Em',
  2: 'Bm',
  3: 'F#m',
  4: 'C#m',
  5: 'G#m',
  6: 'D#m',
};

// MusicXML note type → internal Duration
const TYPE_TO_DURATION: Record<string, Duration> = {
  '64th': Duration.THIRTY_SECOND, // approximate
  '32nd': Duration.THIRTY_SECOND,
  '16th': Duration.SIXTEENTH,
  eighth: Duration.EIGHTH,
  quarter: Duration.QUARTER,
  half: Duration.HALF,
  whole: Duration.WHOLE,
  breve: Duration.WHOLE, // approximate
  long: Duration.WHOLE, // approximate
};

// MusicXML accidental text → internal Accidental
const ACCIDENTAL_MAP: Record<string, Accidental> = {
  sharp: '#',
  flat: 'b',
  natural: 'n',
  'double-sharp': '##',
  'sharp-sharp': '##',
  'flat-flat': 'bb',
  'natural-sharp': '#',
  'natural-flat': 'b',
  'quarter-sharp': 'd#',
  'quarter-flat': 'db',
  'three-quarters-sharp': '3d#',
  'three-quarters-flat': '3db',
};

function stepOctaveToMidi(step: string, alter: number, octave: number): number {
  const semitones = STEP_SEMITONES[step.toUpperCase()] ?? 0;
  // Preserve fractional alter values (e.g. ±0.5 quarter-tones) in the MIDI pitch.
  return (octave + 1) * 12 + semitones + alter;
}

function parseDecorations(noteEl: Element): Decoration[] {
  const decorations: Decoration[] = [];

  const articulations = noteEl.querySelector('notations articulations');
  if (articulations) {
    if (articulations.querySelector('staccato')) decorations.push('staccato');
    if (articulations.querySelector('accent, strong-accent'))
      decorations.push('accent');
    if (articulations.querySelector('tenuto')) decorations.push('tenuto');
    if (articulations.querySelector('breath-mark')) decorations.push('breath');
  }

  const ornaments = noteEl.querySelector('notations ornaments');
  if (ornaments) {
    if (ornaments.querySelector('trill-mark')) decorations.push('trill');
  }

  if (noteEl.querySelector('notations fermata')) decorations.push('fermata');

  // Note-attached dynamics
  const dynamics = noteEl.querySelector('notations dynamics');
  if (dynamics) {
    for (const dyn of [
      'pppp',
      'ppp',
      'pp',
      'p',
      'mp',
      'mf',
      'f',
      'ff',
      'fff',
      'ffff',
    ] as Decoration[]) {
      if (dynamics.querySelector(dyn)) {
        decorations.push(dyn);
        break;
      }
    }
  }

  return decorations;
}

/** Read the bar type from a <barline> element, or null if it's a plain standard barline. */
function getBarType(barEl: Element | null): BarLineType | null {
  if (!barEl) return null;

  const repeat = barEl.querySelector('repeat');
  if (repeat) {
    const dir = repeat.getAttribute('direction');
    if (dir === 'backward') return 'end_repeat';
    if (dir === 'forward') return 'begin_repeat';
  }

  switch (barEl.querySelector('bar-style')?.textContent?.trim()) {
    case 'light-heavy':
      return 'end';
    case 'light-light':
      return 'double';
    case 'heavy-light':
      return 'begin';
    default:
      return null;
  }
}

/** Get direct child elements with a given tag name. */
function children(el: Element, tag: string): Element[] {
  return Array.from(el.children).filter((c) => c.tagName === tag);
}

/** Get the text content of a direct child element. */
function childText(el: Element, tag: string): string {
  return children(el, tag)[0]?.textContent?.trim() ?? '';
}

/**
 * Parse a MusicXML string into a Music object.
 * Only the first part (instrument) is imported.
 * For multi-voice parts, only voice 1 is used.
 */
export function fromMusicXml(xmlText: string): Music {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(
      `XML parse error: ${parseError.textContent?.slice(0, 200)}`
    );
  }

  const music = new Music();

  // Title from work-title or movement-title
  const workTitle = doc.querySelector('work work-title')?.textContent?.trim();
  const movementTitle = doc
    .querySelector('movement-title')
    ?.textContent?.trim();
  music.title = workTitle || movementTitle || '';

  const composer = doc
    .querySelector('identification creator[type="composer"]')
    ?.textContent?.trim();
  if (composer) music.composer = composer;

  // score-timewise is rare but supported — just take the first part
  const part = doc.querySelector(
    'score-partwise > part, score-timewise > measure > part'
  );
  if (!part) return music;

  const measures = Array.from(part.children).filter(
    (c) => c.tagName === 'measure'
  );

  // Tie chain tracking: midiPitch → note index where the current chain began.
  // A chain of consecutive same-pitch ties is collapsed into a single curve
  // [chainStart, chainEnd] to avoid nested parentheses in the ABC output.
  const openTieChains = new Map<number, number>();
  // Slur tracking: slur number → note index at which the slur started
  const openSlurs = new Map<number, number>();
  // Glissando tracking: glissando number → note index at which the glissando started
  const openGlissandos = new Map<number, number>();
  // Span decoration (crescendo/diminuendo) tracking: wedge number → {type, startNoteIndex}
  const openWedges = new Map<
    number,
    { type: 'crescendo' | 'diminuendo'; startNoteIndex: number }
  >();

  /** Return the signature entry at atNoteIndex, creating one if needed. */
  function sigAt(atNoteIndex: number): Signature {
    const last = music.signatures[music.signatures.length - 1];
    if (last.atNoteIndex === atNoteIndex) return last;
    const newSig: Signature = { ...last, atNoteIndex };
    music.signatures.push(newSig);
    return newSig;
  }

  for (const measure of measures) {
    const noteCountBeforeMeasure = music.notes.length;

    // Left barline — fires BEFORE this measure's notes are added
    const leftBarline =
      Array.from(measure.children).find(
        (c) => c.tagName === 'barline' && c.getAttribute('location') === 'left'
      ) ?? null;
    const leftBarType = getBarType(leftBarline);
    if (leftBarType === 'begin_repeat') {
      if (noteCountBeforeMeasure === 0) {
        // Repeat at the very start — no preceding note to anchor to;
        // push a sentinel bar with afterNoteNum undefined
        music.bars.push({ afterNoteNum: undefined, type: 'begin_repeat' });
      } else {
        const lastBar = music.bars.at(-1);
        if (
          lastBar &&
          lastBar.afterNoteNum === noteCountBeforeMeasure - 1 &&
          lastBar.type === 'end_repeat'
        ) {
          // Combine adjacent end_repeat + begin_repeat into begin_end_repeat
          lastBar.type = 'begin_end_repeat';
        } else {
          music.bars.push({
            afterNoteNum: noteCountBeforeMeasure - 1,
            type: 'begin_repeat',
          });
        }
      }
    }

    // Volta (first/second endings): <ending number="N" type="start"> on the
    // left barline means the notes in this measure belong to ending N.
    // We attach the volta number to the bar that immediately precedes this
    // measure (i.e., the most recently pushed bar), which matches the ABC
    // model where `volta` on a bar means "notes after this bar are in volta N".
    const leftEnding = leftBarline?.querySelector('ending');
    if (leftEnding?.getAttribute('type') === 'start') {
      const voltaNum = parseInt(leftEnding.getAttribute('number') ?? '0', 10);
      if (voltaNum > 0) {
        const lastBar = music.bars.at(-1);
        if (lastBar) lastBar.volta = voltaNum;
      }
    }

    // Attributes (key, time, clef) — may appear in any measure; changes after
    // the first measure create a new Signature entry at the current note index.
    const attributes =
      Array.from(measure.children).find((c) => c.tagName === 'attributes') ??
      null;
    if (attributes) {
      // <divisions> defines the rhythmic grid but we rely on symbolic <type> for
      // durations, so we intentionally skip parsing it.

      const keyEl = children(attributes, 'key')[0] ?? null;
      const timeEl = children(attributes, 'time')[0] ?? null;

      if (keyEl || timeEl) {
        const sig = sigAt(noteCountBeforeMeasure);
        if (keyEl) {
          const fifths = parseInt(childText(keyEl, 'fifths') || '0', 10);
          const mode = childText(keyEl, 'mode').toLowerCase() || 'major';
          const keyMap =
            mode === 'minor' ? FIFTHS_TO_MINOR_KEY : FIFTHS_TO_MAJOR_KEY;
          sig.keySignature = keyMap[fifths] ?? 'C';
        }
        if (timeEl) {
          const symbol = timeEl.getAttribute('symbol');
          if (symbol === 'common') {
            sig.beatsPerBar = 4;
            sig.beatValue = 4;
            sig.commonTime = true;
          } else if (symbol === 'cut') {
            sig.beatsPerBar = 2;
            sig.beatValue = 2;
            sig.commonTime = true;
          } else {
            sig.beatsPerBar = parseInt(childText(timeEl, 'beats') || '4', 10);
            sig.beatValue = parseInt(childText(timeEl, 'beat-type') || '4', 10);
            sig.commonTime = undefined;
          }
        }
      }

      const clefEl = children(attributes, 'clef')[0] ?? null;
      if (clefEl) {
        const sign = childText(clefEl, 'sign').toUpperCase();
        const octaveChange = parseInt(
          childText(clefEl, 'clef-octave-change') || '0',
          10
        );
        if (sign === 'G')
          music.clef = octaveChange === 1 ? 'treble8va' : 'treble';
        else if (sign === 'F')
          music.clef = octaveChange === 1 ? 'bass8va' : 'bass';
        else if (sign === 'C') music.clef = 'alto';
      }
    }

    // Notes and directions — iterate children in document order so that
    // directions between notes (tempo changes, wedges) are processed at the
    // correct note-index boundary.
    for (const child of Array.from(measure.children)) {
      if (child.tagName === 'direction') {
        // Tempo from <sound tempo="...">
        const soundEl = child.querySelector('sound');
        if (soundEl?.hasAttribute('tempo')) {
          const bpm = Math.round(
            parseFloat(soundEl.getAttribute('tempo') ?? '0')
          );
          if (bpm > 0) {
            const sig = sigAt(music.notes.length);
            sig.tempo = bpm;
            // Tempo text label (e.g. "Allegro") from a sibling <words> element
            const words = child.querySelector('direction-type words');
            const label = words?.textContent?.trim();
            if (label) sig.tempoText = label;
          }
        }

        // Span decorations (crescendo / diminuendo) from <wedge>
        const wedgeEl = child.querySelector('direction-type wedge');
        if (wedgeEl) {
          const wedgeType = wedgeEl.getAttribute('type');
          const wedgeNum = parseInt(wedgeEl.getAttribute('number') || '1', 10);
          if (wedgeType === 'crescendo' || wedgeType === 'diminuendo') {
            openWedges.set(wedgeNum, {
              type: wedgeType,
              startNoteIndex: music.notes.length,
            });
          } else if (wedgeType === 'stop') {
            const open = openWedges.get(wedgeNum);
            if (open !== undefined) {
              music.spanDecorations.push({
                type: open.type,
                startNoteIndex: open.startNoteIndex,
                endNoteIndex: music.notes.length - 1,
              });
              openWedges.delete(wedgeNum);
            }
          }
        }
      } else if (child.tagName === 'note') {
        const noteEl = child;

        // Only process voice 1
        const voiceText = childText(noteEl, 'voice');
        if (voiceText && parseInt(voiceText, 10) > 1) continue;

        const isChord = noteEl.querySelector('chord') !== null;
        const isGrace = noteEl.querySelector('grace') !== null;
        const isRest = noteEl.querySelector('rest') !== null;

        // Duration
        const typeText = childText(noteEl, 'type') || 'quarter';
        const dotCount = noteEl.querySelectorAll('dot').length;
        const timeModEl = noteEl.querySelector('time-modification');

        let duration: Duration;
        let dots = 0;
        let tupletActual: number | null = null;
        let tupletNormal: number | null = null;

        if (isGrace) {
          const slash = noteEl.querySelector('grace')?.getAttribute('slash');
          duration = slash === 'yes' ? Duration.GRACE_SLASH : Duration.GRACE;
        } else {
          duration = TYPE_TO_DURATION[typeText] ?? Duration.QUARTER;
          if (dotCount > 0) {
            dots = dotCount;
          } else if (timeModEl) {
            tupletActual = parseInt(
              timeModEl.querySelector('actual-notes')?.textContent || '3',
              10
            );
            tupletNormal = parseInt(
              timeModEl.querySelector('normal-notes')?.textContent || '2',
              10
            );
          }
        }

        if (isRest) {
          const restNote = new Note(undefined, duration, [], [], dots);
          if (tupletActual !== null && tupletNormal !== null) {
            restNote.tuplet = {
              actual: tupletActual,
              written: tupletNormal,
              groupSize: tupletActual,
            };
          }
          music.notes.push(restNote);
          continue;
        }

        // Pitch
        const pitchEl = noteEl.querySelector('pitch');
        const step = pitchEl ? childText(pitchEl, 'step') || 'C' : 'C';
        const alter =
          parseFloat(pitchEl ? childText(pitchEl, 'alter') || '0' : '0') || 0;
        const octave = parseInt(
          pitchEl ? childText(pitchEl, 'octave') || '4' : '4',
          10
        );
        const midiPitch = stepOctaveToMidi(step, alter, octave);

        // Accidental
        const accidentalText =
          noteEl.querySelector('accidental')?.textContent?.trim() ?? '';
        let accidental: Accidental = ACCIDENTAL_MAP[accidentalText];
        if (accidental === undefined && alter !== 0) {
          if (alter === 0.5) accidental = 'd#';
          else if (alter === -0.5) accidental = 'db';
          else if (alter === 1.5) accidental = '3d#';
          else if (alter === -1.5) accidental = '3db';
          else if (alter >= 1) accidental = alter >= 2 ? '##' : '#';
          else accidental = alter <= -2 ? 'bb' : 'b';
        }

        if (isChord && music.notes.length > 0) {
          // Add pitch to the previous note (chord voicing)
          const lastNote = music.notes[music.notes.length - 1];
          lastNote.pitches.push(midiPitch);
          lastNote.accidentals.push(accidental);
          continue;
        }

        const decorations = parseDecorations(noteEl);
        const note = new Note(
          midiPitch,
          duration,
          decorations,
          accidental,
          dots
        );
        if (tupletActual !== null && tupletNormal !== null) {
          note.tuplet = {
            actual: tupletActual,
            written: tupletNormal,
            groupSize: tupletActual,
          };
        }
        music.notes.push(note);

        const noteIndex = music.notes.length - 1;

        // Lyrics
        for (const lyricEl of noteEl.querySelectorAll('lyric')) {
          const verseNum =
            parseInt(lyricEl.getAttribute('number') ?? '1', 10) - 1;
          const text = lyricEl.querySelector('text')?.textContent?.trim() ?? '';
          const syllabic =
            lyricEl.querySelector('syllabic')?.textContent?.trim() ?? 'single';
          if (text) {
            while (music.lyrics.length <= verseNum) music.lyrics.push([]);
            const syllable =
              syllabic === 'begin' || syllabic === 'middle'
                ? text + '-'
                : text + ' ';
            music.lyrics[verseNum][noteIndex] = syllable;
          }
        }

        // Ties — chained ties (stop + start on the same note) extend an open
        // chain rather than closing and reopening it, so the whole chain
        // becomes one curve.
        let hasTieStop = false;
        let hasTieStart = false;
        for (const tieEl of noteEl.querySelectorAll('tie')) {
          const t = tieEl.getAttribute('type');
          if (t === 'stop') hasTieStop = true;
          if (t === 'start') hasTieStart = true;
        }
        if (hasTieStop) {
          const chainStart = openTieChains.get(midiPitch);
          if (chainStart !== undefined) {
            if (hasTieStart) {
              // Middle of chain: keep the chain open (chainStart stays)
            } else {
              // End of chain: close it
              music.curves.push([chainStart, noteIndex]);
              openTieChains.delete(midiPitch);
            }
          }
        }
        if (hasTieStart && !hasTieStop) {
          // Start of a new chain
          openTieChains.set(midiPitch, noteIndex);
        }

        // Slurs
        for (const slurEl of noteEl.querySelectorAll('notations slur')) {
          const slurType = slurEl.getAttribute('type');
          const slurNumber = parseInt(slurEl.getAttribute('number') || '1', 10);
          if (slurType === 'start') {
            openSlurs.set(slurNumber, noteIndex);
          } else if (slurType === 'stop') {
            const startIdx = openSlurs.get(slurNumber);
            if (startIdx !== undefined) {
              music.curves.push([startIdx, noteIndex]);
              openSlurs.delete(slurNumber);
            }
          }
        }

        // Glissandos
        for (const glissEl of noteEl.querySelectorAll('notations glissando')) {
          const glissType = glissEl.getAttribute('type');
          const glissNumber = parseInt(
            glissEl.getAttribute('number') || '1',
            10
          );
          if (glissType === 'start') {
            openGlissandos.set(glissNumber, noteIndex);
          } else if (glissType === 'stop') {
            const startIdx = openGlissandos.get(glissNumber);
            if (startIdx !== undefined) {
              music.spanDecorations.push({
                type: 'glissando',
                startNoteIndex: startIdx,
                endNoteIndex: noteIndex,
              });
              openGlissandos.delete(glissNumber);
            }
          }
        }
      }
    }

    // Compute beam groups for this measure from the beam elements
    recomputeBeamsForMeasure(measure, noteCountBeforeMeasure, music);

    // Right barline — fires AFTER this measure's notes
    const rightBarline =
      Array.from(measure.children).find(
        (c) =>
          c.tagName === 'barline' &&
          (c.getAttribute('location') === 'right' ||
            !c.hasAttribute('location'))
      ) ?? null;
    const rightBarType = getBarType(rightBarline);

    if (music.notes.length > 0) {
      music.bars.push({
        afterNoteNum: music.notes.length - 1,
        type: rightBarType ?? 'standard',
      });
    }
  }

  // Close any wedges that were never explicitly stopped
  for (const open of openWedges.values()) {
    if (music.notes.length > 0) {
      music.spanDecorations.push({
        type: open.type,
        startNoteIndex: open.startNoteIndex,
        endNoteIndex: music.notes.length - 1,
      });
    }
  }

  // Remove redundant trailing standard barlines if the last bar is already 'end'
  // (some exporters add both a standard bar and a final bar)
  const lastBar = music.bars.at(-1);
  const secondToLast = music.bars.at(-2);
  if (
    lastBar?.type === 'standard' &&
    secondToLast?.afterNoteNum === lastBar.afterNoteNum
  ) {
    music.bars.pop();
  }

  return music;
}

/**
 * Recompute beam groups for notes added during a single measure.
 * Removes any beams that were tentatively pushed for this measure's range
 * and replaces them with correct ones derived from the MusicXML beam elements.
 */
function recomputeBeamsForMeasure(
  measure: Element,
  noteCountBeforeMeasure: number,
  music: Music
): void {
  // Remove beams that touch the range added by this measure
  music.beams = music.beams.filter(([, e]) => e < noteCountBeforeMeasure);

  // Walk the measure's note elements (voice 1 only), tracking beam state
  let beamStartIdx: number | null = null;
  let noteIdx = noteCountBeforeMeasure;

  for (const noteEl of Array.from(measure.children).filter(
    (c) => c.tagName === 'note'
  )) {
    const voiceText = noteEl.querySelector('voice')?.textContent?.trim();
    if (voiceText && parseInt(voiceText, 10) > 1) continue;
    if (noteEl.querySelector('chord')) continue;

    const primaryBeam = Array.from(noteEl.querySelectorAll('beam')).find(
      (b) => b.getAttribute('number') === '1' || !b.hasAttribute('number')
    );

    const beamValue = primaryBeam?.textContent?.trim();
    if (beamValue === 'begin') {
      beamStartIdx = noteIdx;
    } else if (beamValue === 'continue' && beamStartIdx === null) {
      beamStartIdx = noteIdx;
    } else if (beamValue === 'end') {
      if (beamStartIdx !== null && noteIdx > beamStartIdx) {
        music.beams.push([beamStartIdx, noteIdx]);
      }
      beamStartIdx = null;
    }

    noteIdx++;
  }
}

/**
 * Extract the MusicXML document from a compressed .mxl file (ZIP format).
 * Returns the XML string.
 */
export function extractMxl(buffer: ArrayBuffer): string {
  const files = unzipSync(new Uint8Array(buffer));

  const containerBytes = files['META-INF/container.xml'];
  if (!containerBytes)
    throw new Error('Invalid .mxl: missing META-INF/container.xml');

  const containerXml = new TextDecoder().decode(containerBytes);
  const containerDoc = new DOMParser().parseFromString(
    containerXml,
    'application/xml'
  );
  const rootfilePath = containerDoc
    .querySelector('rootfile')
    ?.getAttribute('full-path');
  if (!rootfilePath)
    throw new Error('Invalid .mxl: no rootfile in container.xml');

  const musicXmlBytes = files[rootfilePath];
  if (!musicXmlBytes)
    throw new Error(`Invalid .mxl: rootfile "${rootfilePath}" not found`);

  return new TextDecoder().decode(musicXmlBytes);
}
