import type { VoiceInfo } from './abcImport';

const PIANO_MIDI_MAX = 24;

function isTrebleClef(v: VoiceInfo): boolean {
  return v.music.clef === 'treble' || v.music.clef === 'treble8va';
}

function isBassClef(v: VoiceInfo): boolean {
  return v.music.clef === 'bass' || v.music.clef === 'bass8va';
}

function isPianoInstrument(v: VoiceInfo): boolean {
  const i = v.midiInstrument;
  return i !== undefined && i >= 1 && i <= PIANO_MIDI_MAX;
}

/**
 * Pick a (treble, bass) pair to render as a grand staff.
 *
 * Priority:
 *   1. A treble + a bass voice in the same `{...}` brace group.
 *   2. Voices whose `%%MIDI voice instrument=N` is in the piano range (1–24).
 *   3. First treble + first bass.
 *
 * TODO: when we render two-voice-per-staff, the `braceGroup.sameStaff`
 * sub-groups will let us pick all voices on each staff.
 */
export function findGrandStaffPair(
  voices: VoiceInfo[]
): { treble: VoiceInfo; bass: VoiceInfo } | null {
  const trebles = voices.filter(isTrebleClef);
  const basses = voices.filter(isBassClef);
  if (trebles.length === 0 || basses.length === 0) return null;

  // 1. Brace-group pair.
  for (const t of trebles) {
    if (!t.braceGroup) continue;
    const ids = new Set(t.braceGroup.voices);
    const b = basses.find(
      (bv) => ids.has(bv.id) && bv.braceGroup === t.braceGroup
    );
    if (b) return { treble: t, bass: b };
  }

  // 2. Piano-family instrument pair.
  const pianoTreble = trebles.find(isPianoInstrument) ?? null;
  const pianoBass = basses.find(isPianoInstrument) ?? null;
  if (pianoTreble && pianoBass) return { treble: pianoTreble, bass: pianoBass };

  // 3. First treble + first bass.
  return { treble: trebles[0], bass: basses[0] };
}
