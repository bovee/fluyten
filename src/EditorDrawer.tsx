import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { debounce } from './utils';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Autorenew from '@mui/icons-material/Autorenew';
import Mic from '@mui/icons-material/Mic';
import MicOff from '@mui/icons-material/MicOff';
import Piano from '@mui/icons-material/Piano';
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
import { GenerateNotesDialog } from './scales/GenerateNotesDialog';
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

interface EditorDrawerProps {
  open: boolean;
  readOnly?: boolean;
  abcMusic: string;
  onAbcChange: (abc: string) => void;
  voices: VoiceInfo[];
  selectedVoiceIdx: number;
  onVoiceChange: (idx: number) => void;
  parseError: string;
  onHeightChange?: (height: number) => void;
}

export function EditorDrawer({
  open,
  readOnly,
  abcMusic,
  onAbcChange,
  voices,
  selectedVoiceIdx,
  onVoiceChange,
  parseError,
  onHeightChange,
}: EditorDrawerProps) {
  const { t } = useTranslation();
  const tempo = useStore((s) => s.tempo);
  const drawerRef = useRef<HTMLDivElement>(null);
  const abcTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [abcSelection, setAbcSelection] = useState({ start: 0, end: 0 });

  // Local copy of ABC text for immediate textarea feedback; debounce the
  // expensive upstream re-render triggered by onAbcChange.
  const [localAbc, setLocalAbc] = useState(abcMusic);
  // Track what we last sent upstream so we can distinguish echoed-back props
  // (which we should ignore) from genuine external changes (transforms, reflow).
  const lastSentRef = useRef(abcMusic);

  useEffect(() => {
    if (abcMusic !== lastSentRef.current) {
      setLocalAbc(abcMusic);
      lastSentRef.current = abcMusic;
    }
  }, [abcMusic]);

  // Keep a ref to onAbcChange so the debounced function (created once) always
  // calls the latest version without needing to be recreated.
  const onAbcChangeRef = useRef(onAbcChange);
  useEffect(() => {
    onAbcChangeRef.current = onAbcChange;
  }, [onAbcChange]);

  const debouncedOnAbcChange = useMemo(
    () =>
      debounce((value: string) => {
        lastSentRef.current = value;
        onAbcChangeRef.current(value);
      }, 300),
    [] // stable — reads latest callback via ref at call-time
  );

  const handleAbcChange = useCallback(
    (value: string) => {
      setLocalAbc(value);
      debouncedOnAbcChange.call(value);
    },
    [debouncedOnAbcChange]
  );
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(
    null
  );
  const [transformMenuAnchor, setTransformMenuAnchor] =
    useState<HTMLElement | null>(null);
  const [voiceMenuAnchor, setVoiceMenuAnchor] = useState<HTMLElement | null>(
    null
  );
  const [scaleDialogOpen, setScaleDialogOpen] = useState(false);

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
    for (const line of localAbc.split('\n')) {
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
        const writtenPitch = ctx.clef.endsWith('8va') ? pitch - 12 : pitch;
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
    if (!open && isTranscribing) stopTranscribing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]); // intentionally omits isTranscribing — only react to drawer close

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

  // `onSelect` on the textarea doesn't fire reliably on iOS/iPadOS for
  // touch-based selection (long-press + drag handles). The document-level
  // `selectionchange` event fires consistently across all browsers.
  useEffect(() => {
    const handler = () => {
      if (document.activeElement === abcTextareaRef.current) {
        updateAbcSelection();
      }
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, []);

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
      alert(`Reflow failed: ${(e as Error).message}`);
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

  const handleGenerateNotes = (notesAbc: string) => {
    setScaleDialogOpen(false);
    const insertPos =
      abcSelection.start >= notesStartIndex
        ? abcSelection.start
        : abcMusic.length;
    const separator =
      insertPos > 0 && abcMusic[insertPos - 1] !== '\n' ? ' ' : '';
    const newAbc =
      abcMusic.slice(0, insertPos) +
      separator +
      notesAbc +
      abcMusic.slice(insertPos);
    const newPos = insertPos + separator.length + notesAbc.length;
    pendingSelectionRef.current = { start: newPos, end: newPos };
    onAbcChange(newAbc);
  };

  return (
    <Drawer
      variant="persistent"
      anchor="bottom"
      open={open}
      role="region"
      aria-label={t('editMusic')}
      PaperProps={{ ref: drawerRef }}
    >
      <Box sx={{ px: 3, pt: 1, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <TextField
            fullWidth
            multiline
            minRows={4}
            maxRows={8}
            error={!!parseError}
            helperText={parseError || undefined}
            label={t('abcNotation')}
            value={localAbc}
            onChange={(e) => {
              handleAbcChange(e.target.value);
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
            {voices.length > 1 && (
              <Tooltip title={t('selectedVoice')}>
                <IconButton
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => setVoiceMenuAnchor(e.currentTarget)}
                  aria-label={t('selectedVoice')}
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    position: 'relative',
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      fontFamily: 'inherit',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {(voices[selectedVoiceIdx]?.name ||
                      voices[selectedVoiceIdx]?.id ||
                      '?')[0].toUpperCase()}
                  </Box>
                  <Box
                    component="span"
                    sx={{
                      fontSize: '0.5rem',
                      lineHeight: 1,
                      ml: '1px',
                      alignSelf: 'flex-end',
                      mb: '2px',
                    }}
                  >
                    ▾
                  </Box>
                </IconButton>
              </Tooltip>
            )}
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
            <Tooltip title={t('generateNotes')}>
              <span>
                <IconButton
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setScaleDialogOpen(true)}
                  disabled={!!readOnly || isTranscribing}
                  aria-label={t('generateNotes')}
                >
                  <Piano />
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
        <Menu
          anchorEl={voiceMenuAnchor}
          open={!!voiceMenuAnchor}
          onClose={() => setVoiceMenuAnchor(null)}
        >
          {voices.map((v, i) => (
            <MenuItem
              key={v.id}
              selected={i === selectedVoiceIdx}
              onClick={() => {
                onVoiceChange(i);
                setVoiceMenuAnchor(null);
              }}
            >
              {v.name || v.id}
            </MenuItem>
          ))}
        </Menu>
      </Box>
      <GenerateNotesDialog
        open={scaleDialogOpen}
        onClose={() => setScaleDialogOpen(false)}
        onGenerate={handleGenerateNotes}
        songKey={(() => {
          const kLine = abcMusic.split('\n').find((l) => l.startsWith('K:'));
          return kLine ? kLine.slice(2).trim().split(/\s/)[0] : 'C';
        })()}
      />
    </Drawer>
  );
}
