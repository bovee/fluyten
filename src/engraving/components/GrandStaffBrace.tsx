interface Props {
  /** Y at top of the upper staff. */
  topY: number;
  /** Y at bottom of the lower staff. */
  bottomY: number;
  /** X at which the brace's vertical bar sits (right edge of brace, against staff). */
  x: number;
}

export function GrandStaffBrace({ topY, bottomY, x }: Props) {
  const h = bottomY - topY;
  const midY = (topY + bottomY) / 2;
  // Cubic Bézier brace shape: two bulges meeting at the middle point.
  const w = 6;
  const bulge = 5;
  const right = x;
  const left = x - w;
  const path = [
    `M ${right} ${topY}`,
    `C ${left - bulge} ${topY + h * 0.1}, ${left} ${midY - h * 0.15}, ${left + 1} ${midY}`,
    `C ${left} ${midY + h * 0.15}, ${left - bulge} ${bottomY - h * 0.1}, ${right} ${bottomY}`,
    `L ${right} ${bottomY}`,
    `C ${left + 2} ${bottomY - h * 0.1}, ${left + 3} ${midY + h * 0.1}, ${left + 4} ${midY}`,
    `C ${left + 3} ${midY - h * 0.1}, ${left + 2} ${topY + h * 0.1}, ${right} ${topY}`,
    `Z`,
  ].join(' ');
  return <path d={path} fill="currentColor" />;
}
