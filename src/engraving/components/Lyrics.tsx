import { LYRICS_LINE_HEIGHT, STAFF_HEIGHT } from '../layout/types';

interface LyricsProps {
  /** Parallel to verse index: lyrics[verse] = syllable string or undefined. */
  lyrics: (string | undefined)[];
  x: number;
  staffTopY: number;
  /** Per-verse horizontal nudge to avoid overlap with adjacent syllables. */
  nudges?: number[];
}

const LYRICS_FONT_SIZE = 14;
// First verse starts far enough below the bottom staff line to clear ledger lines
const LYRICS_BASE_OFFSET = STAFF_HEIGHT + LYRICS_LINE_HEIGHT * 2;

export function LyricsSyllables({ lyrics, x, staffTopY, nudges }: LyricsProps) {
  const visible = lyrics.filter((s) => s !== undefined);
  if (visible.length === 0) return null;

  return (
    <g>
      {lyrics.map((syllable, verse) => {
        if (!syllable) return null;
        const y = staffTopY + LYRICS_BASE_OFFSET + verse * LYRICS_LINE_HEIGHT;
        return (
          <text
            key={verse}
            x={x + (nudges?.[verse] ?? 0)}
            y={y}
            textAnchor="middle"
            fontSize={LYRICS_FONT_SIZE}
            fontFamily="'EB Garamond', Georgia, serif"
            fill="currentColor"
          >
            {syllable}
          </text>
        );
      })}
    </g>
  );
}
