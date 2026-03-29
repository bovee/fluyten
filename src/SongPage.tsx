import { useCallback, useEffect, useRef, useState, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import IconButton from '@mui/material/IconButton';
import SpeedDial from '@mui/material/SpeedDial';
import Tooltip from '@mui/material/Tooltip';
import SpeedDialAction from '@mui/material/SpeedDialAction';
import Typography from '@mui/material/Typography';
import ArrowBack from '@mui/icons-material/ArrowBack';
import Edit from '@mui/icons-material/Edit';
import Mic from '@mui/icons-material/Mic';
import MusicNote from '@mui/icons-material/MusicNote';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Speed from '@mui/icons-material/Speed';

import {
  voicesFromAbc,
  defaultClefForInstrument,
  type VoiceInfo,
} from './io/abcImport';
import { Music, expandRepeats } from './music';
import { FrequencyTracker } from './audio/FrequencyTracker';
import { NotePlayer } from './audio/NotePlayer';
import { MusicTimeline } from './audio/MusicTimeline';
import { Score } from './engraving';
import { useStore } from './store';
import { type Song } from './music';
import { NOTE_NAMES } from './constants';
import { EditorDrawer } from './EditorDrawer';

const PLAY_SAMPLE_RATE = 1000;
const RECORD_SAMPLE_RATE = 50;

/** Tracks a repeating window.setInterval ID in both state (for reactive UI) and a ref (for stale-closure-safe cleanup). */
function useIntervalRef() {
  const [isActive, setIsActive] = useState(false);
  const idRef = useRef<number | null>(null);

  const set = useCallback((id: number) => {
    idRef.current = id;
    setIsActive(true);
  }, []);

  const clear = useCallback(() => {
    if (idRef.current !== null) {
      clearInterval(idRef.current);
      idRef.current = null;
    }
    setIsActive(false);
  }, []);

  return { isActive, set, clear };
}

function usePitchDetection(
  expandedTrackingRef: React.MutableRefObject<{
    notes: { pitches: number[] }[];
    originalIndices: number[];
    idx: number;
  }>,
  setPlayedNotes: React.Dispatch<React.SetStateAction<number>>,
  setStatusMessage: (msg: string) => void
) {
  const { t } = useTranslation();
  const [detectedPitch, setDetectedPitch] = useState<number | null>(null);
  const freqTrackerInterval = useIntervalRef();
  /* eslint-disable react-hooks/refs */
  const freqTrackerRef = useRef<FrequencyTracker>(
    new FrequencyTracker(
      (pitch: number) => {
        setDetectedPitch(pitch);
        setPlayedNotes((nNotes) => {
          const tracking = expandedTrackingRef.current;
          const expandedNote = tracking.notes[tracking.idx];
          if (expandedNote && expandedNote.pitches[0] === pitch) {
            const origIdx = tracking.originalIndices[tracking.idx];
            tracking.idx++;
            // Keep colorNotes monotonically increasing so notes stay green
            // even as the repeat loops back to earlier original indices.
            return Math.max(nNotes, origIdx + 1);
          }
          return nNotes;
        });
      },
      () => setDetectedPitch(null)
    )
  );
  /* eslint-enable react-hooks/refs */

  const startRecording = async () => {
    if (freqTrackerInterval.isActive) {
      freqTrackerInterval.clear();
      freqTrackerRef.current?.stop();
      setDetectedPitch(null);
      setStatusMessage(t('recordingStopped'));
      return;
    }

    const { instrumentType, tuning } = useStore.getState();

    try {
      await freqTrackerRef.current.start();
      setPlayedNotes(0);
      expandedTrackingRef.current.idx = 0; // reset expanded tracking position
      const id = window.setInterval(() => {
        freqTrackerRef.current?.checkFrequency({ instrumentType, tuning });
      }, RECORD_SAMPLE_RATE);
      freqTrackerInterval.set(id);
      setStatusMessage(t('recordingStarted'));
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert(`Failed to start recording: ${(error as Error).message}`);
    }
  };

  useEffect(() => () => freqTrackerInterval.clear(), []);

  return {
    detectedPitch,
    isRecording: freqTrackerInterval.isActive,
    startRecording,
  };
}

function useInTempoChecking(
  musicRef: React.MutableRefObject<Music>,
  tempoRef: React.MutableRefObject<number>,
  setStatusMessage: (msg: string) => void
) {
  const { t } = useTranslation();
  const [detectedPitch, setDetectedPitch] = useState<number | null>(null);
  const [noteResults, setNoteResults] = useState<
    ReadonlyMap<number, 'correct' | 'wrong'>
  >(new Map());
  const [cursor, setCursor] = useState<{ noteIdx: number } | undefined>();
  const [countdown, setCountdown] = useState<number | null>(null);
  const freqInterval = useIntervalRef();
  // Track the current note index (original) being evaluated, and whether the
  // correct pitch was detected at any point during that note's time window.
  const currentNoteIdxRef = useRef(-1);
  const correctSeenRef = useRef(false);
  const noteResultsMapRef = useRef(new Map<number, 'correct' | 'wrong'>());
  const timelineRef = useRef<MusicTimeline | null>(null);
  const rafRef = useRef<number | null>(null);
  const countdownTimeoutsRef = useRef<number[]>([]);

  /* eslint-disable react-hooks/refs */
  const freqTrackerRef = useRef<FrequencyTracker>(
    new FrequencyTracker(
      (pitch: number) => {
        setDetectedPitch(pitch);
        // Check if this pitch matches the current expected note.
        const noteIdx = currentNoteIdxRef.current;
        if (noteIdx >= 0) {
          const note = musicRef.current.notes[noteIdx];
          if (note && note.pitches[0] === pitch) {
            correctSeenRef.current = true;
          }
        }
      },
      () => setDetectedPitch(null)
    )
  );
  /* eslint-enable react-hooks/refs */

  const stopAll = () => {
    for (const id of countdownTimeoutsRef.current) clearTimeout(id);
    countdownTimeoutsRef.current = [];
    setCountdown(null);
    freqInterval.clear();
    freqTrackerRef.current.stop();
    timelineRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setCursor(undefined);
  };

  const startRecording = async () => {
    if (freqInterval.isActive) {
      stopAll();
      setStatusMessage(t('recordingStopped'));
      return;
    }

    const { instrumentType, tuning } = useStore.getState();
    const music = musicRef.current;

    try {
      await freqTrackerRef.current.start();
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert(`Failed to start recording: ${(error as Error).message}`);
      return;
    }

    const freqId = window.setInterval(() => {
      freqTrackerRef.current.checkFrequency({ instrumentType, tuning });
    }, RECORD_SAMPLE_RATE);
    freqInterval.set(freqId);

    currentNoteIdxRef.current = -1;
    correctSeenRef.current = false;
    noteResultsMapRef.current = new Map();
    setNoteResults(new Map());
    setStatusMessage(t('recordingStarted'));

    // 3-2-1 countdown: schedule audible beeps at the song's tempo, then start
    // the player and cursor only after all 3 beats have elapsed.
    const beatMs = (60 / tempoRef.current) * 1000;

    // Schedule 3 click beeps via a short-lived AudioContext so they don't
    // interfere with the silent NotePlayer's AudioContext.
    const clickCtx = new AudioContext();
    const beatSec = 60 / tempoRef.current;
    for (let i = 0; i < 3; i++) {
      const t = clickCtx.currentTime + i * beatSec + 0.02;
      const osc = clickCtx.createOscillator();
      const gain = clickCtx.createGain();
      osc.connect(gain);
      gain.connect(clickCtx.destination);
      osc.type = 'sine';
      osc.frequency.value = i === 0 ? 880 : 660;
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.start(t);
      osc.stop(t + 0.07);
    }
    const closeClick = window.setTimeout(
      () => clickCtx.close(),
      beatMs * 3 + 500
    );

    setCountdown(3);
    const id2 = window.setTimeout(() => setCountdown(2), beatMs);
    const id1 = window.setTimeout(() => setCountdown(1), beatMs * 2);
    const id0 = window.setTimeout(() => {
      setCountdown(null);

      const timeline = new MusicTimeline(music, tempoRef.current);
      timeline.start();
      timelineRef.current = timeline;

      const animate = () => {
        const tl = timelineRef.current;
        if (!tl) return;

        if (tl.isFinished()) {
          stopAll();
          return;
        }

        const now = tl.getCurrentTime();
        const noteIdx = tl.getNoteIdxAtTime(now);
        const floorIdx = Math.floor(noteIdx);

        // When the note index advances, evaluate the note that just finished.
        if (
          floorIdx !== currentNoteIdxRef.current &&
          currentNoteIdxRef.current >= 0
        ) {
          const prevIdx = currentNoteIdxRef.current;
          const prevNote = music.notes[prevIdx];
          if (prevNote && prevNote.pitches.length > 0) {
            noteResultsMapRef.current.set(
              prevIdx,
              correctSeenRef.current ? 'correct' : 'wrong'
            );
            setNoteResults(new Map(noteResultsMapRef.current));
          }
          correctSeenRef.current = false;
        }
        currentNoteIdxRef.current = floorIdx;

        setCursor({ noteIdx });
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
    }, beatMs * 3);

    countdownTimeoutsRef.current = [closeClick, id2, id1, id0];
  };

  useEffect(() => () => stopAll(), []);

  return {
    detectedPitch,
    isRecording: freqInterval.isActive,
    startRecording,
    noteResults,
    cursor,
    countdown,
  };
}

type PlayerEntry = { player: NotePlayer; music: Music; voiceIdx: number };

function useAudioPlayback(
  voicesRef: React.MutableRefObject<VoiceInfo[]>,
  selectedVoiceIdxRef: React.MutableRefObject<number>,
  tempoRef: React.MutableRefObject<number>,
  setPlayedNotes: React.Dispatch<React.SetStateAction<number>>,
  setStatusMessage: (msg: string) => void
) {
  const { t } = useTranslation();
  const musicPlayersRef = useRef<PlayerEntry[]>([]);
  const cursorTimelineRef = useRef<MusicTimeline | null>(null);
  const musicPlayerInterval = useIntervalRef();
  const [cursor, setCursor] = useState<{ noteIdx: number } | undefined>();
  const cursorRafRef = useRef<number | null>(null);

  const clearMusicPlayer = () => {
    musicPlayerInterval.clear();
    for (const { player } of musicPlayersRef.current) player.stop();
    musicPlayersRef.current = [];
    cursorTimelineRef.current = null;
    if (cursorRafRef.current !== null) {
      cancelAnimationFrame(cursorRafRef.current);
      cursorRafRef.current = null;
    }
    setCursor(undefined);
  };

  const startPlaying = () => {
    if (musicPlayerInterval.isActive) {
      clearMusicPlayer();
      setStatusMessage(t('playbackStopped'));
      return;
    }

    const { playbackVoices } = useStore.getState();
    const voices = voicesRef.current;
    const selectedIdx = selectedVoiceIdxRef.current;

    // Only create audible players. The selected voice cursor is handled
    // separately by a MusicTimeline when that voice has no audible player.
    const entries: PlayerEntry[] = voices
      .map((v, i) => {
        const audible =
          playbackVoices === 'selected'
            ? i === selectedIdx
            : playbackVoices === 'others'
              ? i !== selectedIdx
              : true; // 'all'
        if (!audible) return null;
        const player = new NotePlayer();
        player.start();
        player.scheduleNotes(tempoRef.current, v.music);
        return { player, music: v.music, voiceIdx: i };
      })
      .filter((e): e is PlayerEntry => e !== null);

    musicPlayersRef.current = entries;
    setPlayedNotes(0);

    // If the selected voice has no audible player, use a MusicTimeline for cursor.
    const selectedVoice = voices[selectedIdx];
    const selectedIsAudible = entries.some((e) => e.voiceIdx === selectedIdx);
    if (selectedVoice && !selectedIsAudible) {
      const tl = new MusicTimeline(selectedVoice.music, tempoRef.current);
      tl.start();
      cursorTimelineRef.current = tl;
    } else {
      cursorTimelineRef.current = null;
    }

    const id = window.setInterval(() => {
      for (const entry of musicPlayersRef.current) {
        entry.player.scheduleNotes(tempoRef.current, entry.music);
      }
      if (musicPlayersRef.current.every(({ player }) => !player.isPlaying())) {
        clearMusicPlayer();
      }
    }, PLAY_SAMPLE_RATE);
    musicPlayerInterval.set(id);
    setStatusMessage(t('playbackStarted'));

    // requestAnimationFrame cursor: prefer the timeline (when selected voice is
    // silent), otherwise read from the audible selected-voice player.
    const animateCursor = () => {
      const tl = cursorTimelineRef.current;
      if (tl) {
        if (tl.isFinished()) {
          cursorRafRef.current = null;
          return;
        }
        setCursor({ noteIdx: tl.getNoteIdxAtTime(tl.getCurrentTime()) });
        cursorRafRef.current = requestAnimationFrame(animateCursor);
        return;
      }

      const selectedEntry = musicPlayersRef.current.find(
        (e) => e.voiceIdx === selectedVoiceIdxRef.current
      );
      if (!selectedEntry?.player.audioCtx) {
        cursorRafRef.current = requestAnimationFrame(animateCursor);
        return;
      }
      const noteIdx = selectedEntry.player.getNoteIdxAtTime(
        selectedEntry.player.audioCtx.currentTime
      );
      setCursor({ noteIdx });
      cursorRafRef.current = requestAnimationFrame(animateCursor);
    };
    cursorRafRef.current = requestAnimationFrame(animateCursor);
  };

  useEffect(() => () => musicPlayerInterval.clear(), []);

  return { isPlaying: musicPlayerInterval.isActive, startPlaying, cursor };
}

function useMetronome(
  tempoRef: React.MutableRefObject<number>,
  setStatusMessage: (msg: string) => void
) {
  const { t } = useTranslation();
  const metronomeRef = useRef<NotePlayer>(new NotePlayer());
  const metronomeInterval = useIntervalRef();

  const startMetronome = () => {
    if (metronomeInterval.isActive) {
      metronomeInterval.clear();
      metronomeRef.current?.stop();
      setStatusMessage(t('metronomeStopped'));
      return;
    }

    metronomeRef.current?.start();
    metronomeRef.current?.scheduleNotes(tempoRef.current);
    const id = window.setInterval(() => {
      metronomeRef.current?.scheduleNotes(tempoRef.current);
    }, PLAY_SAMPLE_RATE);
    metronomeInterval.set(id);
    setStatusMessage(t('metronomeStarted'));
  };

  useEffect(() => () => metronomeInterval.clear(), []);

  return { isMetronomeActive: metronomeInterval.isActive, startMetronome };
}

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
  const instrumentType = useStore((s) => s.instrumentType);
  const defaultClef = defaultClefForInstrument(instrumentType);
  const [editOpen, setEditOpen] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(0);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [abcMusic, setAbcMusic] = useState(song.abc);
  const [currentParseError, setCurrentParseError] = useState('');
  const [voices, setVoices] = useState(() => {
    try {
      return voicesFromAbc(song.abc, defaultClef);
    } catch {
      return [];
    }
  });
  const [selectedVoiceIdx, setSelectedVoiceIdx] = useState(0);
  const music =
    voices[Math.min(selectedVoiceIdx, voices.length - 1)]?.music ?? new Music();
  const [, setPlayedNotes] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [tempo, setTempo] = useState(song.tempo ?? music.signatures[0].tempo ?? 120);
  const scoreContainerRef = useRef<HTMLDivElement>(null);
  const [scoreWidth, setScoreWidth] = useState(800);
  const tempoRef = useRef(tempo);
  useEffect(() => {
    tempoRef.current = tempo;
  }, [tempo]);

  useLayoutEffect(() => {
    const el = scoreContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setScoreWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const voicesRef = useRef<VoiceInfo[]>(voices);
  useEffect(() => {
    voicesRef.current = voices;
  }, [voices]);
  const selectedVoiceIdxRef = useRef(selectedVoiceIdx);
  useEffect(() => {
    selectedVoiceIdxRef.current = selectedVoiceIdx;
  }, [selectedVoiceIdx]);
  const musicRef = useRef(music);
  useEffect(() => {
    musicRef.current = music;
  }, [music]);

  const expandedTrackingRef = useRef({
    notes: [] as { pitches: number[] }[],
    originalIndices: [] as number[],
    idx: 0,
  });
  useEffect(() => {
    const expanded = expandRepeats(music);
    expandedTrackingRef.current = {
      notes: expanded.notes,
      originalIndices: expanded.originalIndices,
      idx: 0,
    };
  }, [music]);

  const handleTempoChange = (newTempo: number) => {
    tempoRef.current = newTempo;
    setTempo(newTempo);
    onTempoChange?.(newTempo);
  };

  const checkPlayingMode = useStore((s) => s.checkPlayingMode);

  const {
    detectedPitch: pitchA,
    isRecording: isRecordingA,
    startRecording: startRecordingA,
  } = usePitchDetection(expandedTrackingRef, setPlayedNotes, setStatusMessage);

  const {
    detectedPitch: pitchB,
    isRecording: isRecordingB,
    startRecording: startRecordingB,
    noteResults,
    cursor: inTempoCursor,
    countdown,
  } = useInTempoChecking(musicRef, tempoRef, setStatusMessage);

  const detectedPitch = checkPlayingMode === 'in-tempo' ? pitchB : pitchA;
  const isRecording =
    checkPlayingMode === 'in-tempo' ? isRecordingB : isRecordingA;
  const startRecording =
    checkPlayingMode === 'in-tempo' ? startRecordingB : startRecordingA;

  const {
    isPlaying,
    startPlaying,
    cursor: playbackCursor,
  } = useAudioPlayback(
    voicesRef,
    selectedVoiceIdxRef,
    tempoRef,
    setPlayedNotes,
    setStatusMessage
  );
  const { isMetronomeActive, startMetronome } = useMetronome(
    tempoRef,
    setStatusMessage
  );

  useEffect(() => {
    try {
      const newVoices = voicesFromAbc(abcMusic, defaultClef);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVoices(newVoices);
      setSelectedVoiceIdx((idx) => Math.min(idx, newVoices.length - 1));
      setCurrentParseError('');
      if (!readOnly) onAbcChange?.(abcMusic);
    } catch (error) {
      setCurrentParseError((error as Error).message);
    }
  }, [abcMusic]);

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
      <Tooltip title={t('backToSongList')}>
        <IconButton
          onClick={onBack}
          aria-label={t('backToSongList')}
          style={{ position: 'fixed', top: 8, left: 8 }}
        >
          <ArrowBack />
        </IconButton>
      </Tooltip>
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
        {song.title}
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
      <Tooltip title={t('editMusic')}>
        <IconButton
          onClick={() => setEditOpen((i) => !i)}
          aria-label={t('editMusic')}
          style={{ position: 'fixed', top: 8, right: 8 }}
        >
          <Edit />
        </IconButton>
      </Tooltip>
      <div ref={scoreContainerRef} style={{ width: '100%' }}>
        <Score
          music={music}
          width={scoreWidth}
          noteResults={isRecordingB ? noteResults : undefined}
          cursor={isRecordingB ? inTempoCursor : playbackCursor}
        />
      </div>
      {countdown !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <span
            style={{
              fontSize: '30vw',
              fontWeight: 'bold',
              color: 'rgba(28, 50, 72, 0.18)',
              lineHeight: 1,
              userSelect: 'none',
              fontFamily: "'EB Garamond', Georgia, serif",
            }}
          >
            {countdown}
          </span>
        </div>
      )}
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
            `calc(${theme.spacing(4)} + env(safe-area-inset-bottom, 0px) + ${drawerHeight}px)`,
          right: (theme) => theme.spacing(4),
          transition: 'bottom 225ms cubic-bezier(0, 0, 0.2, 1)',
        }}
      >
        <SpeedDialAction
          icon={<Mic />}
          onClick={startRecording}
          slotProps={{
            tooltip: { title: t('checkPlaying') },
            fab: { sx: { bgcolor: isRecording ? 'primary.main' : 'default' } },
          }}
        />
        <SpeedDialAction
          icon={<MusicNote />}
          onClick={startPlaying}
          slotProps={{
            tooltip: { title: t('playSong') },
            fab: { sx: { bgcolor: isPlaying ? 'primary.main' : 'default' } },
          }}
        />
        <SpeedDialAction
          icon={<Speed />}
          onClick={startMetronome}
          slotProps={{
            tooltip: { title: t('metronome') },
            fab: {
              sx: { bgcolor: isMetronomeActive ? 'primary.main' : 'default' },
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
      <EditorDrawer
        open={editOpen}
        onHeightChange={setDrawerHeight}
        readOnly={readOnly}
        abcMusic={abcMusic}
        onAbcChange={setAbcMusic}
        tempo={tempo}
        onTempoChange={handleTempoChange}
        voices={voices}
        selectedVoiceIdx={selectedVoiceIdx}
        onVoiceChange={setSelectedVoiceIdx}
        parseError={currentParseError}
      />
    </>
  );
}
