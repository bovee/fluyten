/**
 * Renders a note name with small dots above it indicating the octave.
 * 0 dots = C–B (uppercase range), 1 dot = c–b, 2 dots = c'–b' and above.
 */
export function NoteNameDisplay({
  name,
  dots,
  fontSize,
}: {
  name: string;
  dots: number;
  fontSize?: string | number;
}) {
  const dotSize = typeof fontSize === 'number' ? fontSize * 0.28 : 4;
  return (
    <span
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: 1,
        fontSize,
      }}
    >
      <span
        style={{
          display: 'flex',
          gap: dotSize,
          height: dots > 0 ? dotSize + 2 : 0,
          alignItems: 'center',
        }}
      >
        {Array.from({ length: dots }).map((_, i) => (
          <span
            key={i}
            style={{
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              backgroundColor: 'currentColor',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
        ))}
      </span>
      <span>{name}</span>
    </span>
  );
}
