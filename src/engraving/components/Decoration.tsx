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
  pppp: 'pppp', ppp: 'ppp', pp: 'pp', p: 'p',
  mp: 'mp', mf: 'mf', f: 'f', ff: 'ff', fff: 'fff', ffff: 'ffff',
};

// Maps decoration → SMuFL glyph name (above-note versions)
const GLYPH_MAP: Partial<Record<Decoration, string>> = {
  accent:   'articAccentAbove',
  staccato: 'articStaccatoAbove',
  tenuto:   'articTenutoAbove',
  fermata:  'fermataAbove',
  trill:    'ornamentTrill',
};

// Horizontal offset to visually center each glyph on the notehead.
// Staccato origin is already at its center (offset 0); others have left-edge origins.
const GLYPH_X_CENTER_OFFSET: Partial<Record<Decoration, number>> = {
  accent:   -5,   // ~10px wide
  tenuto:   -5,   // ~10px wide
  trill:    -5,   // ~10px wide
  fermata:  -10,  // ~20px wide
  staccato: 0,
};

// Dynamics glyph map for individual letters
const DYNAMIC_GLYPHS: Record<string, string> = {
  p: 'dynamicPiano',
  m: 'dynamicMezzo',
  f: 'dynamicForte',
};

export function DecorationGroup({ decorations, x, stemEndY, staffTopY }: DecorationProps) {
  if (decorations.length === 0) return null;

  const aboveY = Math.min(stemEndY, staffTopY) - 8;
  const belowStaffY = staffTopY + STAFF_HEIGHT + STAFF_SPACE * 3;

  return (
    <g>
      {decorations.map((dec, i) => {
        // Breath mark: comma above the staff, centered on the notehead
        if (dec === 'breath') {
          return (
            <text
              key={i}
              x={x}
              y={staffTopY - 12}
              fontSize={22}
              fontWeight="bold"
              fontFamily="serif"
              textAnchor="middle"
              fill="black"
            >
              ,
            </text>
          );
        }

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
                const el = <Glyph key={ci} name={glyphName} x={gx} y={belowStaffY} />;
                gx += 8;
                return el;
              })}
            </g>
          );
        }

        // SMuFL glyph decorations (articulations, fermata, trill)
        const glyphName = GLYPH_MAP[dec];
        if (glyphName) {
          const xOffset = GLYPH_X_CENTER_OFFSET[dec] ?? 0;
          return <Glyph key={i} name={glyphName} x={x + xOffset} y={aboveY} />;
        }

        return null;
      })}
    </g>
  );
}
