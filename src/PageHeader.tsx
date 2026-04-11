import { type ReactNode, useState } from 'react';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import Settings from '@mui/icons-material/Settings';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';

import { SettingsDialog } from './SettingsDialog';

interface PageHeaderProps {
  subtitle?: ReactNode;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
}

export function PageHeader({
  subtitle,
  leftAction,
  rightAction,
}: PageHeaderProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      {leftAction && (
        <div style={{ position: 'fixed', top: 8, left: 8 }}>{leftAction}</div>
      )}
      {rightAction && (
        <div style={{ position: 'fixed', top: 8, right: 48 }}>
          {rightAction}
        </div>
      )}
      <Tooltip title={t('settingsButton')}>
        <IconButton
          onClick={() => setSettingsOpen(true)}
          aria-label={t('settingsButton')}
          style={{ position: 'fixed', top: 8, right: 8 }}
        >
          <Settings />
        </IconButton>
      </Tooltip>

      <h1
        style={{
          color: theme.palette.text.primary,
          marginTop: '0.2em',
          marginBottom: '0.2em',
        }}
      >
        {t('appTitle')}
      </h1>
      {subtitle && (
        <Typography
          component="h2"
          sx={{
            color: 'text.secondary',
            mt: '0.25em',
            fontSize: '1.1rem',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
          }}
        >
          {subtitle}
        </Typography>
      )}

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
