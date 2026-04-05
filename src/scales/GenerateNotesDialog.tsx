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
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import { useTranslation } from 'react-i18next';
import { type ChordDef, buildChord, generateChordAbc } from './chordGenerator';
import { generateScaleAbc } from './scaleGenerator';
import { useStore } from '../store';

// ---------------------------------------------------------------------------
// Chord / arpeggio data — derived from roots + intervals
// ---------------------------------------------------------------------------

const MAJOR_INTERVALS = [0, 4, 7];
const MINOR_INTERVALS = [0, 3, 7];
const DOM7_INTERVALS = [0, 4, 7, 10];
const DIM7_INTERVALS = [0, 3, 6, 9];

function displayRoot(root: string): string {
  return root.replace('#', '♯').replace('b', '♭');
}

function chords(roots: string[], intervals: number[], suffix = ''): ChordDef[] {
  return roots.map((root) => ({
    name: displayRoot(root) + suffix,
    notes: buildChord(root, intervals),
  }));
}

// Convert an ABC-prefixed note string (e.g. "^F", "_B") back to a root name ("F#", "Bb").
function abcToRoot(note: string): string {
  if (note[0] === '^') return note[1] + '#';
  if (note[0] === '_') return note[1] + 'b';
  return note[0];
}

const SCALE_ROOTS = ['C', 'G', 'F', 'D', 'Bb', 'A', 'Eb', 'E', 'Ab', 'B', 'Db'];
const MINOR_ROOTS = ['A', 'E', 'D', 'B', 'G', 'F#', 'C', 'C#', 'F', 'G#', 'Bb'];

const MAJOR_CHORDS = chords(SCALE_ROOTS, MAJOR_INTERVALS);
const MINOR_CHORDS = chords(MINOR_ROOTS, MINOR_INTERVALS, 'm');

// Dominant 7th chords ordered by their parent major scale.
// The dominant is the 5th of each major scale — index [2] of its triad (4 letter positions up).
const DOMINANT_SEVENTH_CHORDS: ChordDef[] = SCALE_ROOTS.map((scaleRoot) => {
  const domRoot = abcToRoot(buildChord(scaleRoot, MAJOR_INTERVALS)[2]);
  return {
    name: `${displayRoot(scaleRoot)} (${displayRoot(domRoot)}7)`,
    notes: buildChord(domRoot, DOM7_INTERVALS),
  };
});

// Diminished 7th chords ordered by their parent harmonic minor scale.
// The leading tone (vii°7) is the major 7th above the minor root — 11 semitones up,
// 6 letter positions up — which is index [3] since buildChord advances 2 letters per index.
const DIMINISHED_SEVENTH_CHORDS: ChordDef[] = MINOR_ROOTS.map((minorRoot) => {
  const viiRoot = abcToRoot(buildChord(minorRoot, [0, 0, 0, 11])[3]);
  return {
    name: `${displayRoot(minorRoot)} (${displayRoot(viiRoot)}°7)`,
    notes: buildChord(viiRoot, DIM7_INTERVALS),
  };
});

// ---------------------------------------------------------------------------

interface GenerateNotesDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (notesAbc: string) => void;
  /** Current key signature of the target song (e.g. "G", "Am").
   *  Used to emit explicit accidentals for notes that differ from the song key. */
  songKey?: string;
}

export function GenerateNotesDialog({
  open,
  onClose,
  onGenerate,
  songKey,
}: GenerateNotesDialogProps) {
  const { t } = useTranslation();
  const instrumentType = useStore((state) => state.instrumentType);
  const [tab, setTab] = useState(0);
  const [range, setRange] = useState<'traditional' | 'all'>('traditional');
  const [direction, setDirection] = useState<
    'ascending' | 'descending' | 'random'
  >('ascending');
  const [selectedKey, setSelectedKey] = useState('C');
  const [selectedChord, setSelectedChord] = useState('C');

  const handleCreate = () => {
    if (tab === 0) {
      onGenerate(
        generateScaleAbc({
          key: selectedKey,
          range,
          direction,
          instrumentType,
          songKey,
        })
      );
    } else {
      const allChords =
        tab === 1
          ? [...MAJOR_CHORDS, ...MINOR_CHORDS]
          : tab === 2
            ? DOMINANT_SEVENTH_CHORDS
            : DIMINISHED_SEVENTH_CHORDS;
      const chord = allChords.find((c) => c.name === selectedChord);
      if (!chord) return;
      onGenerate(
        generateChordAbc({ chord, range, direction, instrumentType, songKey })
      );
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newTab: number) => {
    setTab(newTab);
    if (newTab === 0) setSelectedKey('C');
    else if (newTab === 1) setSelectedChord('C');
    else if (newTab === 2) setSelectedChord(DOMINANT_SEVENTH_CHORDS[0].name);
    else setSelectedChord(DIMINISHED_SEVENTH_CHORDS[0].name);
  };

  const chordRadioGroup = (chords: ChordDef[]) => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
      {chords.map((c) => (
        <FormControlLabel
          key={c.name}
          value={c.name}
          control={<Radio size="small" />}
          label={c.name}
        />
      ))}
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('generateNotes')}</DialogTitle>
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
                e.target.value as 'ascending' | 'descending' | 'random'
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
              value="random"
              control={<Radio />}
              label={t('random')}
            />
          </RadioGroup>
        </FormControl>

        <Tabs
          value={tab}
          onChange={handleTabChange}
          sx={{ mb: 2 }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label={t('scales')} />
          <Tab label={t('commonArpeggios')} />
          <Tab label={t('dominantSeventhArpeggios')} />
          <Tab label={t('diminishedSeventhArpeggios')} />
        </Tabs>

        {tab === 0 && (
          <FormControl component="fieldset" sx={{ width: '100%' }}>
            <RadioGroup
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
            >
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                {t('major')}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                {SCALE_ROOTS.map((root) => (
                  <FormControlLabel
                    key={root}
                    value={root}
                    control={<Radio size="small" />}
                    label={displayRoot(root)}
                  />
                ))}
              </Box>
              <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>
                {t('minor')}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                {MINOR_ROOTS.map((root) => (
                  <FormControlLabel
                    key={root}
                    value={root + 'm'}
                    control={<Radio size="small" />}
                    label={displayRoot(root) + 'm'}
                  />
                ))}
              </Box>
            </RadioGroup>
          </FormControl>
        )}

        {tab === 1 && (
          <FormControl component="fieldset" sx={{ width: '100%' }}>
            <RadioGroup
              value={selectedChord}
              onChange={(e) => setSelectedChord(e.target.value)}
            >
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                {t('major')}
              </Typography>
              {chordRadioGroup(MAJOR_CHORDS)}
              <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>
                {t('minor')}
              </Typography>
              {chordRadioGroup(MINOR_CHORDS)}
            </RadioGroup>
          </FormControl>
        )}

        {tab === 2 && (
          <FormControl component="fieldset" sx={{ width: '100%' }}>
            <RadioGroup
              value={selectedChord}
              onChange={(e) => setSelectedChord(e.target.value)}
            >
              {chordRadioGroup(DOMINANT_SEVENTH_CHORDS)}
            </RadioGroup>
          </FormControl>
        )}

        {tab === 3 && (
          <FormControl component="fieldset" sx={{ width: '100%' }}>
            <RadioGroup
              value={selectedChord}
              onChange={(e) => setSelectedChord(e.target.value)}
            >
              {chordRadioGroup(DIMINISHED_SEVENTH_CHORDS)}
            </RadioGroup>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={handleCreate} variant="contained">
          {t('generate')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
