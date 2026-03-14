import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';

import { useTranslation } from 'react-i18next';
import { generateScaleAbc } from './scaleGenerator';
import { useStore, type UserSong } from './store';

const MAJOR_KEYS = ['C', 'G', 'F', 'D', 'Bb', 'A', 'E', 'Eb', 'Ab'];
const MINOR_KEYS = ['Am', 'Em', 'Dm', 'Bm', 'Gm', 'Cm', 'F#m'];

function displayKey(key: string): string {
  return key.replace('#', '♯').replace('b', '♭');
}

interface ScaleDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (song: UserSong) => void;
}

export function ScaleDialog({ open, onClose, onCreate }: ScaleDialogProps) {
  const { t } = useTranslation();
  const instrumentType = useStore((state) => state.instrumentType);
  const [range, setRange] = useState<'traditional' | 'all'>('traditional');
  const [direction, setDirection] = useState<
    'ascending' | 'descending' | 'both'
  >('both');
  const [selectedKey, setSelectedKey] = useState('C');

  const handleCreate = () => {
    const songs = generateScaleAbc({
      keys: [selectedKey],
      range,
      direction,
      instrumentType,
      formatTitle: (key) => {
        const isMinor = key.endsWith('m');
        const display = (isMinor ? key.slice(0, -1) : key)
          .replace('#', '♯')
          .replace('b', '♭');
        return t('scaleTitle', {
          key: display,
          mode: t(isMinor ? 'minor' : 'major'),
        });
      },
    });
    onCreate(songs[0]);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('generateScale')}</DialogTitle>
      <DialogContent>
        <FormControl sx={{ mb: 2 }}>
          <FormLabel>{t('range')}</FormLabel>
          <RadioGroup
            row
            value={range}
            onChange={(e) => setRange(e.target.value as 'traditional' | 'all')}
          >
            <FormControlLabel
              value="traditional"
              control={<Radio />}
              label={t('oneOctave')}
            />
            <FormControlLabel
              value="all"
              control={<Radio />}
              label={t('instrumentRange')}
            />
          </RadioGroup>
        </FormControl>

        <FormControl sx={{ mb: 2 }}>
          <FormLabel>{t('direction')}</FormLabel>
          <RadioGroup
            row
            value={direction}
            onChange={(e) =>
              setDirection(
                e.target.value as 'ascending' | 'descending' | 'both'
              )
            }
          >
            <FormControlLabel
              value="ascending"
              control={<Radio />}
              label={t('ascending')}
            />
            <FormControlLabel
              value="descending"
              control={<Radio />}
              label={t('descending')}
            />
            <FormControlLabel
              value="both"
              control={<Radio />}
              label={t('both')}
            />
          </RadioGroup>
        </FormControl>

        <FormControl component="fieldset" sx={{ width: '100%' }}>
          <RadioGroup
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
          >
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              {t('major')}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
              {MAJOR_KEYS.map((key) => (
                <FormControlLabel
                  key={key}
                  value={key}
                  control={<Radio size="small" />}
                  label={displayKey(key)}
                />
              ))}
            </Box>
            <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>
              {t('minor')}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
              {MINOR_KEYS.map((key) => (
                <FormControlLabel
                  key={key}
                  value={key}
                  control={<Radio size="small" />}
                  label={displayKey(key)}
                />
              ))}
            </Box>
          </RadioGroup>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={handleCreate} variant="contained">
          {t('create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
