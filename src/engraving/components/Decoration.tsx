import type { Decoration } from '../../music';
import { STAFF_HEIGHT, STAFF_SPACE } from '../layout/types';
import { Glyph } from '../glyphs/Glyph';

interface DecorationProps {
  decorations: Decoration[];
  x: number;
  /** Y of the notehead (reference notehead as in NoteLayout.y). */
  noteY: number;
  stemDirection: 'up' | 'down';
  stemEndY: number;
  staffTopY: number;
}

// Dynamic decorations rendered as text below the staff
const DYNAMICS: Partial<Record<Decoration, string>> = {
  pppp: 'pppp',
  ppp: 'ppp',
  pp: 'pp',
  p: 'p',
  mp: 'mp',
  mf: 'mf',
  f: 'f',
  ff: 'ff',
  fff: 'fff',
  ffff: 'ffff',
};

// Navigation text rendered in italic above the staff (Fine, D.C., D.S., etc.)
const TEXT_ABOVE: Partial<Record<Decoration, string>> = {
  fine: 'Fine',
  alcoda: 'al Coda',
  'd.c.': 'D.C.',
  'd.c.alfine': 'D.C. al Fine',
  'd.c.alcoda': 'D.C. al Coda',
  'd.s.': 'D.S.',
  'd.s.alfine': 'D.S. al Fine',
  'd.s.alcoda': 'D.S. al Coda',
};

// Articulations placed adjacent to the notehead, opposite the stem.
// Uses Above/Below glyph variants depending on stem direction.
const NOTEHEAD_ARTICULATIONS = new Set<Decoration>(['staccato', 'tenuto']);

const NOTEHEAD_GLYPH_ABOVE: Partial<Record<Decoration, string>> = {
  staccato: 'articStaccatoAbove',
  tenuto: 'articTenutoAbove',
};
const NOTEHEAD_GLYPH_BELOW: Partial<Record<Decoration, string>> = {
  staccato: 'articStaccatoBelow',
  tenuto: 'articTenutoBelow',
};

// Maps decoration → SMuFL glyph name (above-note versions, for stem-end placement)
const GLYPH_MAP: Partial<Record<Decoration, string>> = {
  accent: 'articAccentAbove',
  fermata: 'fermataAbove',
  trill: 'ornamentTrill',
  lowermordent: 'ornamentMordent',
  uppermordent: 'ornamentMordentInverted',
  upbow: 'stringsUpBow',
  downbow: 'stringsDownBow',
  turn: 'ornamentTurn',
  turnx: 'ornamentTurnSlash',
  invertedturn: 'ornamentTurnInverted',
  invertedturnx: 'ornamentTurnInvertedSlash',
  coda: 'coda',
  segno: 'segno',
  snap: 'pluckedSnapPizzicatoAbove',
  lhpizz: 'pluckedLeftHandPizzicato',
  open: 'stringsHarmonic',
};

// Font size overrides (fraction of the default FONT_SIZE = 4 * STAFF_SPACE).
const GLYPH_FONT_SIZE: Partial<Record<Decoration, number>> = {
  coda: 2 * 10, // half of default 4*10
  segno: 2 * 10,
};

// Horizontal offset to visually center each glyph on the notehead.
const GLYPH_X_CENTER_OFFSET: Partial<Record<Decoration, number>> = {
  accent: -5, // ~10px wide
  trill: -5, // ~10px wide
  fermata: -10, // ~20px wide
  lowermordent: -5,
  uppermordent: -5,
  upbow: -4,
  downbow: -4,
  staccato: 0,
  tenuto: -5,
  turn: -5,
  turnx: -5,
  invertedturn: -5,
  invertedturnx: -5,
  coda: -8,
  segno: -6,
  snap: -5,
  lhpizz: -5,
  open: -5,
};

// Dynamics glyph map for individual letters
const DYNAMIC_GLYPHS: Record<string, string> = {
  p: 'dynamicPiano',
  m: 'dynamicMezzo',
  f: 'dynamicForte',
};

export function DecorationGroup({
  decorations,
  x,
  noteY,
  stemDirection,
  stemEndY,
  staffTopY,
}: DecorationProps) {
  if (decorations.length === 0) return null;

  const aboveY = Math.min(stemEndY, staffTopY) - 8;
  const belowStaffY = staffTopY + STAFF_HEIGHT + STAFF_SPACE * 3;

  return (
    <g>
      {decorations.map((dec, i) => {
        // Breath mark: rendered separately in Bar.tsx with correct x positioning
        if (dec === 'breath') return null;

        // Dynamics: rendered below the staff in italic
        const dynText = DYNAMICS[dec];
        if (dynText !== undefined) {
          // Build from individual glyph characters
          let gx = x - (dynText.length * 5) / 2;
          return (
            <g key={i}>
              {dynText.split('').map((ch, ci) => {
                const glyphName = DYNAMIC_GLYPHS[ch];
                if (!glyphName) return null;
                const el = (
                  <Glyph key={ci} name={glyphName} x={gx} y={belowStaffY} />
                );
                gx += 8;
                return el;
              })}
            </g>
          );
        }

        // Notehead articulations: placed adjacent to notehead, opposite the stem
        if (NOTEHEAD_ARTICULATIONS.has(dec)) {
          const xOffset = GLYPH_X_CENTER_OFFSET[dec] ?? 0;
          const staccatoFontSize = dec === 'staccato' ? 56 : undefined;
          if (stemDirection === 'up') {
            // Stem up → notehead is at bottom → articulation goes below
            const glyphName = NOTEHEAD_GLYPH_BELOW[dec];
            if (glyphName)
              return (
                <Glyph
                  key={i}
                  name={glyphName}
                  x={x + xOffset}
                  y={noteY + 10}
                  fontSize={staccatoFontSize}
                />
              );
          } else {
            // Stem down → notehead is at top → articulation goes above
            const glyphName = NOTEHEAD_GLYPH_ABOVE[dec];
            if (glyphName)
              return (
                <Glyph
                  key={i}
                  name={glyphName}
                  x={x + xOffset}
                  y={noteY - 8}
                  fontSize={staccatoFontSize}
                />
              );
          }
        }

        // Irish roll: small arc above the note
        if (dec === 'roll') {
          const rx = x,
            ry = aboveY;
          return (
            <path
              key={i}
              d={`M ${rx - 6} ${ry} C ${rx - 3} ${ry - 8} ${rx + 3} ${ry - 8} ${rx + 6} ${ry}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            />
          );
        }

        // Slide: short curved line rising into the notehead from lower-left
        if (dec === 'slide') {
          return (
            <path
              key={i}
              d={`M ${x - 10} ${noteY + 10} Q ${x - 5} ${noteY + 4} ${x} ${noteY}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            />
          );
        }

        // Navigation text (Fine, D.C., D.S. etc.) — italic above the staff
        const navText = TEXT_ABOVE[dec];
        if (navText !== undefined) {
          return (
            <text
              key={i}
              x={x}
              y={aboveY - 4}
              textAnchor="middle"
              fontStyle="italic"
              fontSize={10}
              fill="currentColor"
            >
              {navText}
            </text>
          );
        }

        // SMuFL glyph decorations (fermata, trill, accent) — at stem end / above staff
        const glyphName = GLYPH_MAP[dec];
        if (glyphName) {
          const xOffset = GLYPH_X_CENTER_OFFSET[dec] ?? 0;
          return (
            <Glyph
              key={i}
              name={glyphName}
              x={x + xOffset}
              y={aboveY}
              fontSize={GLYPH_FONT_SIZE[dec]}
            />
          );
        }

        return null;
      })}
    </g>
  );
}
