interface TempoMarkProps {
  tempoText?: string;
  tempo?: number;
  x: number;
  staffTopY: number;
}

export function TempoMark({ tempoText, tempo, x, staffTopY }: TempoMarkProps) {
  if (!tempoText && !tempo) return null;

  const y = staffTopY - 8; // just above the top staff line

  if (tempoText) {
    return (
      <text
        x={x}
        y={y}
        fontSize={13}
        fontFamily="'EB Garamond', Georgia, serif"
        fontStyle="italic"
        fill="black"
      >
        {tempoText}
      </text>
    );
  }

  // Fallback: numeric BPM
  return (
    <text
      x={x}
      y={y}
      fontSize={12}
      fontFamily="'EB Garamond', Georgia, serif"
      fill="black"
    >
      ♩ = {tempo}
    </text>
  );
}
