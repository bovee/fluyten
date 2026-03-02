import { useState } from 'react';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { useTranslation } from 'react-i18next';
import { generateScaleAbc } from './scaleGenerator';
import { useStore, type UserSong } from './store';

const MAJOR_KEYS = ['C', 'G', 'F', 'D', 'Bb', 'A', 'E', 'Eb', 'Ab'];
const MINOR_KEYS = ['Am', 'Em', 'Dm', 'Bm', 'Gm', 'Cm', 'F#m'];
const DEFAULT_KEYS = new Set(['C', 'G', 'F', 'D', 'Bb', 'Am', 'Em', 'Dm']);

function displayKey(key: string): string {
  return key.replace('#', '♯').replace('b', '♭');
}

interface ScaleDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (songs: UserSong[], bookName: string) => void;
}

export function ScaleDialog({ open, onClose, onCreate }: ScaleDialogProps) {
  const { t } = useTranslation();
  const instrumentType = useStore((state) => state.instrumentType);
  const [range, setRange] = useState<'traditional' | 'all'>('traditional');
  const [direction, setDirection] = useState<
    'ascending' | 'descending' | 'both'
  >('both');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(DEFAULT_KEYS)
  );
  const [bookName, setBookName] = useState(() => t('books.scales'));

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleCreate = () => {
    const songs = generateScaleAbc({
      keys: [...MAJOR_KEYS, ...MINOR_KEYS].filter((k) => selectedKeys.has(k)),
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
    onCreate(songs, bookName);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('generateScales')}</DialogTitle>
      <DialogContent>
        <TextField
          label={t('bookName')}
          value={bookName}
          onChange={(e) => setBookName(e.target.value)}
          fullWidth
          sx={{ mt: 1, mb: 3 }}
        />
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

        <FormControl component="fieldset">
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            {t('major')}
          </Typography>
          <FormGroup row>
            {MAJOR_KEYS.map((key) => (
              <FormControlLabel
                key={key}
                control={
                  <Checkbox
                    checked={selectedKeys.has(key)}
                    onChange={() => toggleKey(key)}
                    size="small"
                  />
                }
                label={displayKey(key)}
              />
            ))}
          </FormGroup>

          <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>
            {t('minor')}
          </Typography>
          <FormGroup row>
            {MINOR_KEYS.map((key) => (
              <FormControlLabel
                key={key}
                control={
                  <Checkbox
                    checked={selectedKeys.has(key)}
                    onChange={() => toggleKey(key)}
                    size="small"
                  />
                }
                label={displayKey(key)}
              />
            ))}
          </FormGroup>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={selectedKeys.size === 0}
        >
          {t('create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
