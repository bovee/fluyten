import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Autorenew from '@mui/icons-material/Autorenew';
import Mic from '@mui/icons-material/Mic';
import MicOff from '@mui/icons-material/MicOff';
import SwapVert from '@mui/icons-material/SwapVert';

import {
  parseHeaders,
  defaultClefForInstrument,
  type VoiceInfo,
} from './io/abcImport';
import { singlePitchToAbc, durationToAbc, reflowAbc } from './io/abcExport';
import { TRANSFORMATIONS, transformFragment } from './io/transformations';
import { Music, Duration, DurationModifier } from './music';
import { FrequencyTracker } from './audio/FrequencyTracker';
import { useStore } from './store';

const RECORD_SAMPLE_RATE = 50;

const TRANSCRIBE_DURATION_CANDIDATES: [number, Duration, DurationModifier][] = [
  [1, Duration.SIXTEENTH, DurationModifier.NONE],
  [2, Duration.EIGHTH, DurationModifier.NONE],
  [3, Duration.EIGHTH, DurationModifier.DOTTED],
  [4, Duration.QUARTER, DurationModifier.NONE],
  [6, Duration.QUARTER, DurationModifier.DOTTED],
  [8, Duration.HALF, DurationModifier.NONE],
  [12, Duration.HALF, DurationModifier.DOTTED],
  [16, Duration.WHOLE, DurationModifier.NONE],
  [24, Duration.WHOLE, DurationModifier.DOTTED],
];

interface AbcEditorDrawerProps {
  open: boolean;
  readOnly?: boolean;
  abcMusic: string;
  onAbcChange: (abc: string) => void;
  tempo: number;
  onTempoChange: (tempo: number) => void;
  voices: VoiceInfo[];
  selectedVoiceIdx: number;
  onVoiceChange: (idx: number) => void;
  parseError: string;
  onHeightChange?: (height: number) => void;
}

export function AbcEditorDrawer({
  open,
  readOnly,
  abcMusic,
  onAbcChange,
  tempo,
  onTempoChange,
  voices,
  selectedVoiceIdx,
  onVoiceChange,
  parseError,
  onHeightChange,
}: AbcEditorDrawerProps) {
  const { t } = useTranslation();
  const drawerRef = useRef<HTMLDivElement>(null);
  const abcTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [abcSelection, setAbcSelection] = useState({ start: 0, end: 0 });
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(
    null
  );
  const [transformMenuAnchor, setTransformMenuAnchor] =
    useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const el = drawerRef.current;
    if (!el || !onHeightChange) return;
    if (!open) {
      onHeightChange(0);
      return;
    }
    const observer = new ResizeObserver(() => {
      onHeightChange(el.offsetHeight);
    });
    observer.observe(el);
    onHeightChange(el.offsetHeight);
    return () => observer.disconnect();
  }, [open, onHeightChange]);

  // Ref copy of abcMusic so transcription callbacks can read the latest value
  // between React renders without stale closures.
  const abcMusicRef = useRef(abcMusic);
  useEffect(() => {
    abcMusicRef.current = abcMusic;
  }, [abcMusic]);

  // Ref copy of tempo for transcription duration calculation.
  const tempoRef = useRef(tempo);
  useEffect(() => {
    tempoRef.current = tempo;
  }, [tempo]);

  // --- Transcription ---
  const transcribeTrackerRef = useRef<FrequencyTracker | null>(null);
  const transcribeIntervalRef = useRef<number | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const transcribeCursorRef = useRef<number>(0);
  const transcribeContextRef = useRef<{
    keyAdjustment: { [n: string]: number };
    defaultDuration: Duration;
    clef: Music['clef'];
  } | null>(null);

  // Find the character index where the notes section begins (after the K: line).
  const notesStartIndex = (() => {
    let pos = 0;
    for (const line of abcMusic.split('\n')) {
      pos += line.length + 1;
      if (line.startsWith('K:')) return pos;
    }
    return 0;
  })();

  const stopTranscribing = () => {
    if (transcribeIntervalRef.current !== null) {
      clearInterval(transcribeIntervalRef.current);
      transcribeIntervalRef.current = null;
    }
    transcribeTrackerRef.current?.stop();
    transcribeTrackerRef.current = null;
    transcribeContextRef.current = null;
    setIsTranscribing(false);
  };

  const startTranscribing = async () => {
    const lines = abcMusic.split('\n');
    const { instrumentType, tuning } = useStore.getState();
    const defaultClef = defaultClefForInstrument(instrumentType);
    const tempMusic = new Music();
    const { keyAdjustment, defaultDuration } = parseHeaders(
      lines,
      tempMusic,
      defaultClef
    );
    transcribeContextRef.current = {
      keyAdjustment,
      defaultDuration,
      clef: tempMusic.clef,
    };

    const cursorPos = Math.max(
      abcTextareaRef.current?.selectionStart ?? abcMusic.length,
      notesStartIndex
    );
    transcribeCursorRef.current = cursorPos;

    const tracker = new FrequencyTracker(
      (_p: number) => {},
      (pitch: number, durationSecs: number) => {
        const ctx = transcribeContextRef.current;
        if (!ctx) return;

        const sixteenths = durationSecs * (tempoRef.current / 60) * 4;
        let bestCandidate: [Duration, DurationModifier] = [
          Duration.QUARTER,
          DurationModifier.NONE,
        ];
        let bestDist = Infinity;
        for (const [
          candidateSixteenths,
          dur,
          mod,
        ] of TRANSCRIBE_DURATION_CANDIDATES) {
          const dist = Math.abs(sixteenths - candidateSixteenths);
          if (dist < bestDist) {
            bestDist = dist;
            bestCandidate = [dur, mod];
          }
        }
        const [dur, mod] = bestCandidate;
        const writtenPitch = ctx.clef === 'treble8va' ? pitch - 12 : pitch;
        const pitchStr = singlePitchToAbc(
          writtenPitch,
          undefined as never,
          ctx.keyAdjustment
        );
        const durStr = durationToAbc(dur, mod, ctx.defaultDuration);
        const noteStr = pitchStr + durStr + ' ';

        const pos = transcribeCursorRef.current;
        const next =
          abcMusicRef.current.slice(0, pos) +
          noteStr +
          abcMusicRef.current.slice(pos);
        const newPos = pos + noteStr.length;
        transcribeCursorRef.current = newPos;
        pendingSelectionRef.current = { start: newPos, end: newPos };
        // Update ref immediately so rapid callbacks see the updated string.
        abcMusicRef.current = next;
        onAbcChange(next);
      }
    );

    transcribeTrackerRef.current = tracker;

    try {
      await tracker.start();
      setIsTranscribing(true);
      const id = window.setInterval(() => {
        tracker.checkFrequency({ instrumentType, tuning });
      }, RECORD_SAMPLE_RATE);
      transcribeIntervalRef.current = id;
    } catch (error) {
      transcribeTrackerRef.current = null;
      console.error('Failed to start transcription:', error);
      alert(`Failed to start transcription: ${(error as Error).message}`);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open && isTranscribing) stopTranscribing();
  }, [open]);

  useEffect(() => {
    return () => {
      if (transcribeIntervalRef.current)
        clearInterval(transcribeIntervalRef.current);
      transcribeTrackerRef.current?.stop();
    };
  }, []);

  // After onAbcChange, restore focus + selection to the textarea.
  useEffect(() => {
    if (pendingSelectionRef.current && abcTextareaRef.current) {
      const { start, end } = pendingSelectionRef.current;
      pendingSelectionRef.current = null;
      abcTextareaRef.current.focus();
      abcTextareaRef.current.setSelectionRange(start, end);
    }
  }, [abcMusic]);

  // --- Editor helpers ---
  const updateAbcSelection = () => {
    const textarea = abcTextareaRef.current;
    if (textarea) {
      setAbcSelection({
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      });
    }
  };

  const transformEnabled =
    !readOnly &&
    !isTranscribing &&
    abcSelection.start !== abcSelection.end &&
    abcSelection.start >= notesStartIndex;

  const restoreSelection = () => {
    requestAnimationFrame(() => {
      if (abcTextareaRef.current) {
        abcTextareaRef.current.focus();
        abcTextareaRef.current.setSelectionRange(
          abcSelection.start,
          abcSelection.end
        );
      }
    });
  };

  const handleReflow = () => {
    try {
      const newAbc = reflowAbc(abcMusic);
      onAbcChange(newAbc);
    } catch (e) {
      console.error('Reflow failed:', e);
    }
  };

  const handleTransform = (transformId: string) => {
    setTransformMenuAnchor(null);
    const { start: selectionStart, end: selectionEnd } = abcSelection;
    if (selectionStart === selectionEnd) return;

    const before = abcMusic.slice(0, selectionStart);
    const selected = abcMusic.slice(selectionStart, selectionEnd);
    const after = abcMusic.slice(selectionEnd);

    try {
      const transformed = transformFragment(selected, abcMusic, transformId);
      pendingSelectionRef.current = {
        start: selectionStart,
        end: selectionStart + transformed.length,
      };
      onAbcChange(before + transformed + after);
    } catch {
      restoreSelection();
    }
  };

  return (
    <Drawer
      variant="persistent"
      anchor="bottom"
      open={open}
      PaperProps={{ ref: drawerRef }}
    >
      <Box
        sx={{
          px: 3,
          pt: 2,
          pb: 1,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          alignItems: { sm: 'flex-end' },
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {t('tempoLabel', { tempo })}
          </Typography>
          <Slider
            aria-label="Tempo"
            size="small"
            value={tempo}
            onChange={(_, v) => onTempoChange(v as number)}
            min={20}
            max={200}
            step={5}
          />
        </Box>
        {voices.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 140, flexShrink: 0 }}>
            <InputLabel id="voice-select-label">{t('voice')}</InputLabel>
            <Select
              labelId="voice-select-label"
              value={selectedVoiceIdx}
              label={t('voice')}
              onChange={(e) => onVoiceChange(e.target.value as number)}
            >
              {voices.map((v, i) => (
                <MenuItem key={v.id} value={i}>
                  {v.name || v.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>
      <Box sx={{ px: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <TextField
            fullWidth
            multiline
            minRows={4}
            maxRows={8}
            error={!!parseError}
            helperText={parseError || undefined}
            label={t('abcNotation')}
            value={abcMusic}
            onChange={(e) => {
              onAbcChange(e.target.value);
              updateAbcSelection();
            }}
            onSelect={updateAbcSelection}
            disabled={!!readOnly}
            inputRef={abcTextareaRef}
            inputProps={{ dir: 'ltr' }}
            sx={{
              '& textarea': {
                fontFamily: "'Source Code Pro', ui-monospace, monospace",
              },
            }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Tooltip title={t('transcribe')}>
              <span>
                <IconButton
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    isTranscribing ? stopTranscribing() : startTranscribing()
                  }
                  disabled={!!readOnly}
                  aria-label={t('transcribe')}
                  sx={{ color: isTranscribing ? 'primary.main' : undefined }}
                >
                  {isTranscribing ? <MicOff /> : <Mic />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('reflow')}>
              <span>
                <IconButton
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleReflow}
                  disabled={!!readOnly || isTranscribing}
                  aria-label={t('reflow')}
                >
                  <Autorenew />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('transformNotes')}>
              <span>
                <IconButton
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => setTransformMenuAnchor(e.currentTarget)}
                  disabled={!transformEnabled}
                  aria-label={t('transformNotes')}
                >
                  <SwapVert />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
        <Menu
          anchorEl={transformMenuAnchor}
          open={!!transformMenuAnchor}
          onClose={() => {
            setTransformMenuAnchor(null);
            restoreSelection();
          }}
        >
          {TRANSFORMATIONS.map((transform) => (
            <MenuItem
              key={transform.id}
              onClick={() => handleTransform(transform.id)}
            >
              {t(transform.labelKey)}
            </MenuItem>
          ))}
        </Menu>
      </Box>
    </Drawer>
  );
}
