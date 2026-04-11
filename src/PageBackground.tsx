import { useTheme } from '@mui/material/styles';

export function PageBackground() {
  const theme = useTheme();
  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: theme.palette.background.default,
          zIndex: -2,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          right: '4vw',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '80vh',
          lineHeight: 1,
          color: theme.palette.text.primary,
          opacity: 0.05,
          zIndex: -1,
          pointerEvents: 'none',
          userSelect: 'none',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        𝄞
      </div>
    </>
  );
}
