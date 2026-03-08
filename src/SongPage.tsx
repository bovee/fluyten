import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialAction from '@mui/material/SpeedDialAction';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBack from '@mui/icons-material/ArrowBack';
import Mic from '@mui/icons-material/Mic';
import MusicNote from '@mui/icons-material/MusicNote';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Speed from '@mui/icons-material/Speed';
import Edit from '@mui/icons-material/Edit';

import { voicesFromAbc } from './io/abcImport';
import { Music } from './music';
import { FrequencyTracker } from './FrequencyTracker';
import { NotePlayer } from './NotePlayer';
import { Vexflow } from './Vexflow.tsx';
import { useStore } from './store';
import { type Song } from './songs';
import { NOTE_NAMES } from './constants';

const PLAY_SAMPLE_RATE = 1000;
const RECORD_SAMPLE_RATE = 50;

interface SongPageProps {
  song: Song;
  onBack: () => void;
  readOnly?: boolean;
  onAbcChange?: (abc: string) => void;
  onTempoChange?: (tempo: number) => void;
}

export function SongPage({
  song,
  onBack,
  readOnly,
  onAbcChange,
  onTempoChange,
}: SongPageProps) {
  const { t } = useTranslation();
  const [editOpen, setEditOpen] = useState(false);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [abcMusic, setAbcMusic] = useState(song.abc);
  const [currentParseError, setCurrentParseError] = useState('');
  const [voices, setVoices] = useState(() => voicesFromAbc(song.abc));
  const [selectedVoiceIdx, setSelectedVoiceIdx] = useState(0);
  const music =
    voices[Math.min(selectedVoiceIdx, voices.length - 1)]?.music ?? new Music();
  const [playedNotes, setPlayedNotes] = useState(0);
  const [detectedPitch, setDetectedPitch] = useState<number | null>(null);
  const [cursor, setCursor] = useState<{ noteIdx: number } | undefined>();
  const cursorRafRef = useRef<number | null>(null);

  const [statusMessage, setStatusMessage] = useState('');
  const [tempo, setTempo] = useState(song.tempo ?? 120);
  const tempoRef = useRef(tempo);
  useEffect(() => {
    tempoRef.current = tempo;
  }, [tempo]);

  const handleTempoChange = (newTempo: number) => {
    tempoRef.current = newTempo;
    setTempo(newTempo);
    onTempoChange?.(newTempo);
  };

  // Singleton refs to avoid recreating instances
  const freqTrackerRef = useRef<FrequencyTracker>(
    new FrequencyTracker(
      (pitch: number) => {
        setDetectedPitch(pitch);
        setPlayedNotes((nNotes) => {
          const currentMusic = musicRef.current;
          if (
            nNotes < currentMusic.notes.length &&
            currentMusic.notes[nNotes].pitches[0] === pitch
          ) {
            return nNotes + 1;
          }
          return nNotes;
        });
      },
      () => {
        setDetectedPitch(null);
      }
    )
  );
  const [freqTrackerIntervalId, setFreqTrackerIntervalId] = useState<
    number | null
  >(null);
  const freqTrackerIntervalIdRef = useRef<number | null>(null);
  const metronomeRef = useRef<NotePlayer>(new NotePlayer());
  const [metronomeIntervalId, setMetronomeIntervalId] = useState<number | null>(
    null
  );
  const metronomeIntervalIdRef = useRef<number | null>(null);
  const musicPlayerRef = useRef<NotePlayer>(new NotePlayer());
  const [musicPlayerIntervalId, setMusicPlayerIntervalId] = useState<
    number | null
  >(null);
  const musicPlayerIntervalIdRef = useRef<number | null>(null);

  // Use ref to avoid stale closures
  const musicRef = useRef<Music>(music);
  useEffect(() => {
    musicRef.current = music;
  }, [music]);

  const startRecording = async () => {
    if (freqTrackerIntervalId) {
      clearInterval(freqTrackerIntervalId);
      setFreqTrackerIntervalId(null);
      freqTrackerRef.current?.stop();
      setDetectedPitch(null);
      setStatusMessage(t('recordingStopped'));
      return;
    }

    const { instrumentType, tuning } = useStore.getState();

    try {
      await freqTrackerRef.current.start();
      setPlayedNotes(0);

      const id = window.setInterval(() => {
        freqTrackerRef.current?.checkFrequency({ instrumentType, tuning });
      }, RECORD_SAMPLE_RATE);
      freqTrackerIntervalIdRef.current = id;
      setFreqTrackerIntervalId(id);
      setStatusMessage(t('recordingStarted'));
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert(`Failed to start recording: ${(error as Error).message}`);
    }
  };

  const clearMusicPlayer = () => {
    clearInterval(musicPlayerIntervalIdRef.current ?? undefined);
    musicPlayerIntervalIdRef.current = null;
    setMusicPlayerIntervalId(null);
    musicPlayerRef.current?.stop();
    if (cursorRafRef.current !== null) {
      cancelAnimationFrame(cursorRafRef.current);
      cursorRafRef.current = null;
    }
    setCursor(undefined);
  };

  const startPlaying = () => {
    if (musicPlayerIntervalId) {
      clearMusicPlayer();
      setStatusMessage(t('playbackStopped'));
      return;
    }

    setPlayedNotes(0);
    musicPlayerRef.current?.start();
    musicPlayerRef.current?.scheduleNotes(tempoRef.current, musicRef.current);
    const id = window.setInterval(() => {
      musicPlayerRef.current?.scheduleNotes(tempoRef.current, musicRef.current);
      if (musicPlayerRef.current && !musicPlayerRef.current.isPlaying()) {
        clearMusicPlayer();
      }
    }, PLAY_SAMPLE_RATE);
    musicPlayerIntervalIdRef.current = id;
    setMusicPlayerIntervalId(id);
    setStatusMessage(t('playbackStarted'));

    // requestAnimationFrame loop: ask the player which note is scheduled at
    // currentTime — no independent timing math required.
    const animateCursor = () => {
      const player = musicPlayerRef.current;
      if (!player?.audioCtx) return;

      const noteIdx = player.getNoteIdxAtTime(player.audioCtx.currentTime);
      setCursor({ noteIdx });

      cursorRafRef.current = requestAnimationFrame(animateCursor);
    };
    cursorRafRef.current = requestAnimationFrame(animateCursor);
  };

  const startMetronome = () => {
    if (metronomeIntervalId) {
      clearInterval(metronomeIntervalId);
      setMetronomeIntervalId(null);
      metronomeRef.current?.stop();
      setStatusMessage(t('metronomeStopped'));
      return;
    }

    metronomeRef.current?.start();
    metronomeRef.current?.scheduleNotes(tempoRef.current);
    const id = window.setInterval(() => {
      metronomeRef.current?.scheduleNotes(tempoRef.current);
    }, PLAY_SAMPLE_RATE);
    metronomeIntervalIdRef.current = id;
    setMetronomeIntervalId(id);
    setStatusMessage(t('metronomeStarted'));
  };

  useEffect(() => {
    try {
      const newVoices = voicesFromAbc(abcMusic);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVoices(newVoices);
      setSelectedVoiceIdx((idx) => Math.min(idx, newVoices.length - 1));
      setCurrentParseError('');
      if (!readOnly) onAbcChange?.(abcMusic);
    } catch (error) {
      setCurrentParseError((error as Error).message);
    }
  }, [abcMusic]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (freqTrackerIntervalIdRef.current)
        clearInterval(freqTrackerIntervalIdRef.current);
      if (musicPlayerIntervalIdRef.current)
        clearInterval(musicPlayerIntervalIdRef.current);
      if (metronomeIntervalIdRef.current)
        clearInterval(metronomeIntervalIdRef.current);
    };
  }, []);

  const detectedNoteName =
    detectedPitch !== null ? NOTE_NAMES[detectedPitch % 12] : null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#fffef9',
          zIndex: -1,
        }}
      />
      <IconButton
        onClick={onBack}
        aria-label={t('backToSongList')}
        style={{ position: 'fixed', top: 8, left: 8 }}
      >
        <ArrowBack />
      </IconButton>
      <Typography
        variant="h4"
        component="h1"
        sx={{
          color: '#1c3248',
          px: '52px',
          mt: 0,
          pt: 1,
          fontSize: { xs: '1.4rem', sm: '2rem', md: '2.125rem' },
          lineHeight: 1.2,
          wordBreak: 'break-word',
          fontFamily: "'EB Garamond', Georgia, serif",
        }}
      >
        {t(`songs.${song.id}`, music.title ?? '')}
      </Typography>
      {music.composer && (
        <Typography
          variant="subtitle2"
          component="h2"
          sx={{
            color: '#4a6080',
            px: '52px',
            mt: 0.25,
            fontFamily: "'EB Garamond', Georgia, serif",
            fontStyle: 'italic',
          }}
        >
          {music.composer}
        </Typography>
      )}
      <IconButton
        onClick={() => setEditOpen((i) => !i)}
        aria-label={t('editMusic')}
        style={{ position: 'fixed', top: 8, right: 8 }}
      >
        <Edit />
      </IconButton>
      <Vexflow music={music} colorNotes={playedNotes} cursor={cursor} />
      <SpeedDial
        ariaLabel="Play"
        open={speedDialOpen}
        onOpen={() => setSpeedDialOpen(true)}
        onClose={() => setSpeedDialOpen(false)}
        FabProps={{
          'aria-controls': speedDialOpen ? 'Play-actions' : undefined,
        }}
        icon={
          detectedNoteName ? (
            <Typography
              component="span"
              sx={{ fontWeight: 'bold', fontSize: '0.9rem', lineHeight: 1 }}
            >
              {detectedNoteName}
            </Typography>
          ) : (
            <PlayArrow />
          )
        }
        sx={{
          position: 'fixed',
          bottom: (theme) =>
            `calc(${theme.spacing(4)} + env(safe-area-inset-bottom, 0px))`,
          right: (theme) => theme.spacing(4),
        }}
      >
        <SpeedDialAction
          icon={<Mic />}
          onClick={startRecording}
          slotProps={{
            tooltip: { title: t('checkPlaying') },
            fab: {
              sx: {
                bgcolor: freqTrackerIntervalId ? 'primary.main' : 'default',
              },
            },
          }}
        />
        <SpeedDialAction
          icon={<MusicNote />}
          onClick={startPlaying}
          slotProps={{
            tooltip: { title: t('playSong') },
            fab: {
              sx: {
                bgcolor: musicPlayerIntervalId ? 'primary.main' : 'default',
              },
            },
          }}
        />
        <SpeedDialAction
          icon={<Speed />}
          onClick={startMetronome}
          slotProps={{
            tooltip: { title: t('metronome') },
            fab: {
              sx: {
                bgcolor: metronomeIntervalId ? 'primary.main' : 'default',
              },
            },
          }}
        />
      </SpeedDial>
      <span
        aria-live="polite"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
        }}
      >
        {detectedNoteName ?? ''}
      </span>
      <span
        aria-live="polite"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
        }}
      >
        {statusMessage}
      </span>
      <Drawer variant="persistent" anchor="bottom" open={editOpen}>
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
              onChange={(_, v) => handleTempoChange(v as number)}
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
                onChange={(e) => setSelectedVoiceIdx(e.target.value as number)}
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
          <TextField
            fullWidth
            multiline
            minRows={4}
            maxRows={8}
            error={!!currentParseError}
            helperText={currentParseError || undefined}
            label={t('abcNotation')}
            value={abcMusic}
            onChange={(e) => setAbcMusic(e.target.value)}
            disabled={!!readOnly}
          />
        </Box>
      </Drawer>
    </>
  );
}
