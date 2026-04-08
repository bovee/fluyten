import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import SpeedDial from '@mui/material/SpeedDial';
import Tooltip from '@mui/material/Tooltip';
import SpeedDialAction from '@mui/material/SpeedDialAction';
import Typography from '@mui/material/Typography';
import ArrowBack from '@mui/icons-material/ArrowBack';
import Close from '@mui/icons-material/Close';
import Edit from '@mui/icons-material/Edit';
import Mic from '@mui/icons-material/Mic';
import MusicNote from '@mui/icons-material/MusicNote';
import PlayArrow from '@mui/icons-material/PlayArrow';

import {
  voicesFromAbc,
  defaultClefForInstrument,
  type VoiceInfo,
} from './io/abcImport';
import { resolveInstrumentConfig, RECORDER_TYPES } from './instrument';
import { Music, expandRepeats, findNearestExpandedIndex } from './music';
import { SingleFrequencyTracker } from './audio/SingleFrequencyTracker';
import { NotePlayer } from './audio/NotePlayer';
import { MusicTimeline } from './audio/MusicTimeline';
import { Score } from './engraving';
import { useStore } from './store';
import { type Song } from './music';
import { NOTE_NAMES } from './constants';
import { NoteNameDisplay } from './engraving/NoteNameDisplay';
import { noteOctaveDots } from './engraving/noteNameUtils';
import { EditorDrawer } from './EditorDrawer';

const PLAY_SAMPLE_RATE = 1000;
const RECORD_SAMPLE_RATE = 20;

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
  expandedTrackingRef: React.RefObject<{
    notes: { pitches: number[] }[];
    originalIndices: number[];
    idx: number;
  }>,
  setStatusMessage: (msg: string) => void,
  onFinish: (
    results: ReadonlyMap<number, 'correct' | 'wrong'>,
    correctCount: number,
    totalCount: number
  ) => void
) {
  const { t } = useTranslation();
  const [detectedPitch, setDetectedPitch] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [noteResults, setNoteResults] = useState<
    ReadonlyMap<number, 'correct' | 'wrong'>
  >(new Map());
  const [cursor, setCursor] = useState<{ noteIdx: number } | undefined>();
  const noteResultsMapRef = useRef(new Map<number, 'correct' | 'wrong'>());
  // True while the target note is currently sounding, so we count each note
  // onset only once even if the player holds the note across multiple polls.
  const wasActiveRef = useRef(false);

  const freqTrackerRef = useRef<SingleFrequencyTracker | null>(null);

  const startRecording = async () => {
    if (isRecording) {
      freqTrackerRef.current?.stop();
      freqTrackerRef.current = null;
      setIsRecording(false);
      setDetectedPitch(null);
      setCursor(undefined);
      setStatusMessage(t('recordingStopped'));
      return;
    }

    noteResultsMapRef.current = new Map();
    setNoteResults(new Map());
    expandedTrackingRef.current.idx = 0;
    const firstOriginalIdx = expandedTrackingRef.current.originalIndices[0];
    setCursor(
      firstOriginalIdx !== undefined ? { noteIdx: firstOriginalIdx } : undefined
    );

    const { tuning, instrumentType, customBasePitchStr, customHighNoteStr } =
      useStore.getState();
    const config =
      resolveInstrumentConfig(
        instrumentType,
        customBasePitchStr,
        customHighNoteStr
      ) ?? RECORDER_TYPES.SOPRANO;

    // Point the tracker at the first non-rest note.
    const tracking = expandedTrackingRef.current;
    while (
      tracking.idx < tracking.notes.length &&
      tracking.notes[tracking.idx].pitches.length === 0
    )
      tracking.idx++;
    const firstNote = tracking.notes[tracking.idx];

    const tracker = new SingleFrequencyTracker((active, pitch) => {
      setDetectedPitch(pitch);
      if (active) {
        if (!wasActiveRef.current) {
          // Note onset: advance the cursor.
          wasActiveRef.current = true;
          const tracking = expandedTrackingRef.current;
          const originalIdx = tracking.originalIndices[tracking.idx];
          if (originalIdx !== undefined) {
            noteResultsMapRef.current.set(originalIdx, 'correct');
            setNoteResults(new Map(noteResultsMapRef.current));
          }
          tracking.idx++;
          // Skip over rests to reach the next pitched note.
          while (
            tracking.idx < tracking.notes.length &&
            tracking.notes[tracking.idx].pitches.length === 0
          )
            tracking.idx++;
          if (tracking.idx >= tracking.notes.length) {
            tracker.stop();
            freqTrackerRef.current = null;
            setIsRecording(false);
            setDetectedPitch(null);
            setCursor(undefined);
            setStatusMessage(t('recordingStopped'));
            onFinish(
              new Map(noteResultsMapRef.current),
              tracking.notes.length,
              tracking.notes.length
            );
          } else {
            tracker.setTarget(tracking.notes[tracking.idx].pitches[0], tuning);
            const nextOriginalIdx = tracking.originalIndices[tracking.idx];
            setCursor(
              nextOriginalIdx !== undefined
                ? { noteIdx: nextOriginalIdx }
                : undefined
            );
          }
        }
      } else {
        wasActiveRef.current = false;
      }
    }, RECORD_SAMPLE_RATE);

    if (firstNote) tracker.setTarget(firstNote.pitches[0], tuning);

    try {
      await tracker.start(config.basePitch, config.pitchRange, tuning);
      wasActiveRef.current = false;
      freqTrackerRef.current = tracker;
      setIsRecording(true);
      setStatusMessage(t('recordingStarted'));
    } catch (error) {
      tracker.stop();
      console.error('Failed to start recording:', error);
      alert(`Failed to start recording: ${(error as Error).message}`);
    }
  };

  useEffect(
    () => () => {
      freqTrackerRef.current?.stop();
    },
    [] // cleanup on unmount only
  );

  return {
    detectedPitch,
    isRecording,
    startRecording,
    noteResults,
    cursor,
  };
}

function useInTempoChecking(
  musicRef: React.RefObject<Music>,
  tempoRef: React.RefObject<number>,
  setStatusMessage: (msg: string) => void,
  onFinish: (
    results: ReadonlyMap<number, 'correct' | 'wrong'>,
    correctCount: number,
    totalCount: number
  ) => void
) {
  const { t } = useTranslation();
  const [detectedPitch, setDetectedPitch] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [noteResults, setNoteResults] = useState<
    ReadonlyMap<number, 'correct' | 'wrong'>
  >(new Map());
  const [cursor, setCursor] = useState<{ noteIdx: number } | undefined>();
  const [countdown, setCountdown] = useState<number | null>(null);
  // Track the current note index (original) being evaluated, and whether the
  // correct pitch was detected at any point during that note's time window.
  const currentNoteIdxRef = useRef(-1);
  const correctSeenRef = useRef(false);
  const noteResultsMapRef = useRef(new Map<number, 'correct' | 'wrong'>());
  const correctCountRef = useRef(0);
  const totalCountRef = useRef(0);
  const timelineRef = useRef<MusicTimeline | null>(null);
  const rafRef = useRef<number | null>(null);
  const countdownTimeoutsRef = useRef<number[]>([]);
  const clickCtxRef = useRef<AudioContext | null>(null);

  const freqTrackerRef = useRef<SingleFrequencyTracker | null>(null);

  const stopAll = () => {
    for (const id of countdownTimeoutsRef.current) clearTimeout(id);
    countdownTimeoutsRef.current = [];
    setCountdown(null);
    setIsRecording(false);
    freqTrackerRef.current?.stop();
    freqTrackerRef.current = null;
    clickCtxRef.current?.close();
    clickCtxRef.current = null;
    timelineRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setCursor(undefined);
  };

  const startRecording = async () => {
    if (isRecording) {
      stopAll();
      setStatusMessage(t('recordingStopped'));
      return;
    }

    const { tuning, instrumentType, customBasePitchStr, customHighNoteStr } =
      useStore.getState();
    const config =
      resolveInstrumentConfig(
        instrumentType,
        customBasePitchStr,
        customHighNoteStr
      ) ?? RECORDER_TYPES.SOPRANO;
    const music = musicRef.current;

    const tracker = new SingleFrequencyTracker((active, pitch) => {
      setDetectedPitch(pitch);
      if (active) correctSeenRef.current = true;
    }, RECORD_SAMPLE_RATE);

    try {
      await tracker.start(config.basePitch, config.pitchRange, tuning);
    } catch (error) {
      tracker.stop();
      console.error('Failed to start recording:', error);
      alert(`Failed to start recording: ${(error as Error).message}`);
      return;
    }

    freqTrackerRef.current = tracker;
    setIsRecording(true);

    currentNoteIdxRef.current = -1;
    correctSeenRef.current = false;
    noteResultsMapRef.current = new Map();
    correctCountRef.current = 0;
    totalCountRef.current = 0;
    setNoteResults(new Map());
    setStatusMessage(t('recordingStarted'));

    // 3-2-1 countdown: schedule audible beeps at the song's tempo, then start
    // the player and cursor only after all 3 beats have elapsed.
    const beatMs = (60 / tempoRef.current) * 1000;

    // Schedule 3 click beeps via a short-lived AudioContext so they don't
    // interfere with the silent NotePlayer's AudioContext.
    const clickCtx = new AudioContext();
    clickCtxRef.current = clickCtx;
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
      () => {
        clickCtx.close();
        clickCtxRef.current = null;
      },
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
          const lastIdx = currentNoteIdxRef.current;
          const lastNote = music.notes[lastIdx];
          if (lastIdx >= 0 && lastNote && lastNote.pitches.length > 0) {
            const result = correctSeenRef.current ? 'correct' : 'wrong';
            noteResultsMapRef.current.set(lastIdx, result);
            setNoteResults(new Map(noteResultsMapRef.current));
            totalCountRef.current++;
            if (result === 'correct') correctCountRef.current++;
          }
          stopAll();
          onFinish(
            new Map(noteResultsMapRef.current),
            correctCountRef.current,
            totalCountRef.current
          );
          return;
        }

        const now = tl.getCurrentTime();
        const noteIdx = tl.getNoteIdxAtTime(now);
        const floorIdx = Math.floor(noteIdx);

        // When the note index advances, evaluate the note that just finished
        // and point the tracker at the new expected note.
        if (floorIdx !== currentNoteIdxRef.current) {
          if (currentNoteIdxRef.current >= 0) {
            const prevIdx = currentNoteIdxRef.current;
            const prevNote = music.notes[prevIdx];
            if (prevNote && prevNote.pitches.length > 0) {
              const result = correctSeenRef.current ? 'correct' : 'wrong';
              noteResultsMapRef.current.set(prevIdx, result);
              setNoteResults(new Map(noteResultsMapRef.current));
              totalCountRef.current++;
              if (result === 'correct') correctCountRef.current++;
            }
            correctSeenRef.current = false;
          }
          const newNote = music.notes[floorIdx];
          freqTrackerRef.current?.setTarget(
            newNote && newNote.pitches.length > 0 ? newNote.pitches[0] : 0,
            tuning
          );
        }
        currentNoteIdxRef.current = floorIdx;

        setCursor({ noteIdx });
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
    }, beatMs * 3);

    countdownTimeoutsRef.current = [closeClick, id2, id1, id0];
  };

  useEffect(() => () => stopAll(), []); // cleanup on unmount only

  return {
    detectedPitch,
    isRecording,
    startRecording,
    noteResults,
    cursor,
    countdown,
  };
}

type PlayerEntry = { player: NotePlayer; music: Music; voiceIdx: number };

function useAudioPlayback(
  voicesRef: React.RefObject<VoiceInfo[]>,
  selectedVoiceIdxRef: React.RefObject<number>,
  tempoRef: React.RefObject<number>,
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

  const doStartPlaying = (startTimeOffset: number) => {
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
        player.scheduleNotes(tempoRef.current, v.music, startTimeOffset);
        return { player, music: v.music, voiceIdx: i };
      })
      .filter((e): e is PlayerEntry => e !== null);

    musicPlayersRef.current = entries;

    // If the selected voice has no audible player, use a MusicTimeline for cursor.
    const selectedVoice = voices[selectedIdx];
    const selectedIsAudible = entries.some((e) => e.voiceIdx === selectedIdx);
    if (selectedVoice && !selectedIsAudible) {
      const tl = new MusicTimeline(
        selectedVoice.music,
        tempoRef.current,
        startTimeOffset
      );
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
    if (startTimeOffset === 0) setStatusMessage(t('playbackStarted'));

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

  const startPlaying = (startTimeOffset: number = 0) => {
    if (musicPlayerInterval.isActive) {
      clearMusicPlayer();
      setStatusMessage(t('playbackStopped'));
      return;
    }
    doStartPlaying(startTimeOffset);
  };

  const seekToNote = (origNoteIdx: number) => {
    // Compute the time offset from the selected voice's expanded sequence.
    const selectedVoice = voicesRef.current[selectedVoiceIdxRef.current];
    if (!selectedVoice) return;

    const { notes, originalIndices } = expandRepeats(selectedVoice.music);
    const beatValue = selectedVoice.music.signatures[0].beatValue;
    const tempo = tempoRef.current;
    const lengthToTime = (ticks: number) =>
      (60 / tempo) * (ticks / 1024) * (4 / beatValue);

    // Find current expanded position from the active player or cursor timeline.
    let currentExpandedIdx = 0;
    const selectedEntry = musicPlayersRef.current.find(
      (e) => e.voiceIdx === selectedVoiceIdxRef.current
    );
    if (selectedEntry?.player.audioCtx) {
      const elapsed =
        selectedEntry.player.audioCtx.currentTime -
        selectedEntry.player.startTime;
      // Walk the expanded sequence to find the current expanded index by time.
      let acc = 0;
      for (let i = 0; i < notes.length; i++) {
        acc += lengthToTime(notes[i].ticks());
        if (acc > elapsed) {
          currentExpandedIdx = i;
          break;
        }
        if (i === notes.length - 1) currentExpandedIdx = i;
      }
    }

    const targetK = findNearestExpandedIndex(
      originalIndices,
      origNoteIdx,
      currentExpandedIdx
    );
    if (targetK === -1) return;

    // Sum durations up to targetK to get the time offset.
    let startTimeOffset = 0;
    for (let i = 0; i < targetK; i++) {
      startTimeOffset += lengthToTime(notes[i].ticks());
    }

    // Stop current playback and restart from the computed offset.
    clearMusicPlayer();
    doStartPlaying(startTimeOffset);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => musicPlayerInterval.clear(), []); // cleanup on unmount only

  return {
    isPlaying: musicPlayerInterval.isActive,
    startPlaying,
    seekToNote,
    cursor,
  };
}

function useMetronome(
  tempoRef: React.RefObject<number>,
  setStatusMessage: (msg: string) => void
) {
  const { t } = useTranslation();
  const metronomeRef = useRef<NotePlayer>(new NotePlayer());
  const metronomeInterval = useIntervalRef();

  const stopMetronome = () => {
    if (!metronomeInterval.isActive) return;
    metronomeInterval.clear();
    metronomeRef.current?.stop();
    setStatusMessage(t('metronomeStopped'));
  };

  const startMetronome = () => {
    if (metronomeInterval.isActive) return;
    metronomeRef.current?.start();
    metronomeRef.current?.scheduleNotes(tempoRef.current);
    const id = window.setInterval(() => {
      metronomeRef.current?.scheduleNotes(tempoRef.current);
    }, PLAY_SAMPLE_RATE);
    metronomeInterval.set(id);
    setStatusMessage(t('metronomeStarted'));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => metronomeInterval.clear(), []); // cleanup on unmount only

  return {
    isMetronomeActive: metronomeInterval.isActive,
    startMetronome,
    stopMetronome,
  };
}

interface SongPageProps {
  song: Song;
  onBack: () => void;
  readOnly?: boolean;
  onAbcChange?: (abc: string) => void;
}

export function SongPage({
  song,
  onBack,
  readOnly,
  onAbcChange,
}: SongPageProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const instrumentType = useStore((s) => s.instrumentType);
  const customBasePitchStr = useStore((s) => s.customBasePitchStr);
  const customHighNoteStr = useStore((s) => s.customHighNoteStr);
  const instrumentConfig =
    resolveInstrumentConfig(
      instrumentType,
      customBasePitchStr,
      customHighNoteStr
    ) ?? RECORDER_TYPES.SOPRANO;
  const defaultClef = defaultClefForInstrument(instrumentConfig.basePitch);
  let defaultMiddle = undefined;
  if (defaultClef === 'bass8va') defaultMiddle = 'd';
  if (defaultClef === 'bass') defaultMiddle = 'D';
  const [editOpen, setEditOpen] = useState(() => {
    try {
      const v = voicesFromAbc(song.abc, defaultClef, defaultMiddle);
      return v.every((voice) => voice.music.notes.length === 0);
    } catch {
      return true;
    }
  });
  const [drawerHeight, setDrawerHeight] = useState(0);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [abcMusic, setAbcMusic] = useState(song.abc);
  const [currentParseError, setCurrentParseError] = useState('');
  const [voices, setVoices] = useState(() => {
    try {
      return voicesFromAbc(song.abc, defaultClef, defaultMiddle);
    } catch {
      return [];
    }
  });
  const [selectedVoiceIdx, setSelectedVoiceIdx] = useState(0);
  const music = useMemo(
    () =>
      voices[Math.min(selectedVoiceIdx, voices.length - 1)]?.music ??
      new Music(),
    [voices, selectedVoiceIdx]
  );
  const [statusMessage, setStatusMessage] = useState('');
  const tempo = useStore((s) => s.tempo);
  const scoreContainerRef = useRef<HTMLDivElement>(null);
  const [scoreWidth, setScoreWidth] = useState(800);
  const tempoRef = useRef(tempo);
  useEffect(() => {
    // Use the songs tempo, falling back to the global tempo
    tempoRef.current = music.signatures[0]?.tempo ?? tempo;
  }, [tempo, music]);

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
    // Collapse tie chains: a note is a tie continuation if the previous
    // expanded note has the same pitches and a curve connects them.
    const isTieContinuation = (i: number): boolean => {
      if (i === 0) return false;
      const prev = expanded.notes[i - 1];
      const curr = expanded.notes[i];
      if (
        prev.pitches.length === 0 ||
        prev.pitches.length !== curr.pitches.length ||
        !prev.pitches.every((p, j) => p === curr.pitches[j])
      )
        return false;
      return expanded.curves.some(([s, e]) => s === i - 1 && e === i);
    };
    const notes: { pitches: number[] }[] = [];
    const originalIndices: number[] = [];
    for (let i = 0; i < expanded.notes.length; i++) {
      if (!isTieContinuation(i)) {
        notes.push(expanded.notes[i]);
        originalIndices.push(expanded.originalIndices[i]);
      }
    }
    expandedTrackingRef.current = { notes, originalIndices, idx: 0 };
  }, [music]);

  const practiceMode = useStore((s) => s.practiceMode);
  const playMetronomeOnStart = useStore((s) => s.playMetronome);
  const autoScroll = useStore((s) => s.autoScroll);

  const [practiceSummary, setPracticeSummary] = useState<{
    noteResults: ReadonlyMap<number, 'correct' | 'wrong'>;
    correctCount: number;
    totalCount: number;
  } | null>(null);
  const onPracticeFinish = useCallback(
    (
      results: ReadonlyMap<number, 'correct' | 'wrong'>,
      correctCount: number,
      totalCount: number
    ) => {
      if (totalCount > 0) {
        const pct = Math.round((correctCount / totalCount) * 100);
        useStore.getState().recordPracticeSession(song.id, pct);
        setPracticeSummary({ noteResults: results, correctCount, totalCount });
      }
    },
    [song.id]
  );

  const {
    detectedPitch: pitchA,
    isRecording: isRecordingA,
    startRecording: startRecordingA,
    noteResults: asPlayedNoteResults,
    cursor: asPlayedCursor,
  } = usePitchDetection(
    expandedTrackingRef,
    setStatusMessage,
    onPracticeFinish
  );

  const {
    detectedPitch: pitchB,
    isRecording: isRecordingB,
    startRecording: startRecordingB,
    noteResults,
    cursor: inTempoCursor,
    countdown,
  } = useInTempoChecking(
    musicRef,
    tempoRef,
    setStatusMessage,
    onPracticeFinish
  );

  const detectedPitch = practiceMode === 'in-tempo' ? pitchB : pitchA;
  const isRecording = practiceMode === 'in-tempo' ? isRecordingB : isRecordingA;
  const startRecording =
    practiceMode === 'in-tempo' ? startRecordingB : startRecordingA;
  const {
    isPlaying,
    startPlaying,
    seekToNote,
    cursor: playbackCursor,
  } = useAudioPlayback(
    voicesRef,
    selectedVoiceIdxRef,
    tempoRef,
    setStatusMessage
  );
  const { isMetronomeActive, startMetronome, stopMetronome } = useMetronome(
    tempoRef,
    setStatusMessage
  );

  const isPracticing = isMetronomeActive || isRecording;

  useEffect(() => {
    if (!isRecording) stopMetronome();
  }, [isRecording, stopMetronome]);

  useEffect(() => {
    try {
      const newVoices = voicesFromAbc(abcMusic, defaultClef, defaultMiddle);

      setVoices(newVoices);
      setSelectedVoiceIdx((idx) => Math.min(idx, newVoices.length - 1));
      setCurrentParseError('');
      if (!readOnly) onAbcChange?.(abcMusic);
    } catch (error) {
      setCurrentParseError((error as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abcMusic, defaultClef, defaultMiddle]); // intentionally omits onAbcChange/readOnly — adding them would cause loops

  const detectedNoteName =
    detectedPitch !== null ? NOTE_NAMES[detectedPitch % 12] : null;
  const detectedNoteOctaveDots =
    detectedPitch !== null
      ? noteOctaveDots(detectedPitch, instrumentConfig.basePitch)
      : 0;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: theme.palette.background.default,
          zIndex: -1,
        }}
      />
      <Tooltip title={t('backToSongList')}>
        <IconButton
          onClick={onBack}
          aria-label={t('backToSongList')}
          style={{ position: 'fixed', top: 8, left: 8 }}
          sx={{ displayPrint: 'none' }}
        >
          <ArrowBack />
        </IconButton>
      </Tooltip>
      <Typography
        variant="h4"
        component="h1"
        sx={{
          color: theme.palette.text.primary,
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
            color: theme.palette.text.secondary,
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
          sx={{ displayPrint: 'none' }}
        >
          <Edit />
        </IconButton>
      </Tooltip>
      <div ref={scoreContainerRef} style={{ width: '100%' }}>
        <Score
          music={music}
          width={scoreWidth}
          noteResults={
            isRecordingB
              ? noteResults
              : isRecordingA
                ? asPlayedNoteResults
                : practiceSummary?.noteResults
          }
          cursor={
            isRecordingB
              ? inTempoCursor
              : isRecordingA
                ? asPlayedCursor
                : playbackCursor
          }
          autoScroll={autoScroll}
          onNoteClick={isPlaying ? seekToNote : undefined}
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
            aria-live="assertive"
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
              sx={{
                fontWeight: 'bold',
                fontSize: '1.2rem',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <NoteNameDisplay
                name={detectedNoteName}
                dots={detectedNoteOctaveDots}
                fontSize="1.2rem"
              />
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
          onClick={() => {
            if (isPlaying) startPlaying();
            else if (practiceMode === 'metronome-only') {
              if (isMetronomeActive) stopMetronome();
              else startMetronome();
            } else {
              startRecording();
              if (playMetronomeOnStart && !isRecording) startMetronome();
            }
          }}
          slotProps={{
            tooltip: { title: t('settingsTabPractice') },
            fab: { sx: { bgcolor: isPracticing ? 'primary.main' : 'default' } },
          }}
        />
        <SpeedDialAction
          icon={<MusicNote />}
          onClick={() => {
            if (isPracticing) {
              if (isRecording) startRecording();
              stopMetronome();
            } else {
              startPlaying();
            }
          }}
          slotProps={{
            tooltip: { title: t('playSong') },
            fab: { sx: { bgcolor: isPlaying ? 'primary.main' : 'default' } },
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
      <Snackbar
        open={practiceSummary !== null}
        onClose={() => setPracticeSummary(null)}
        message={t('practiceComplete', {
          correct: practiceSummary?.correctCount ?? 0,
          total: practiceSummary?.totalCount ?? 0,
        })}
        action={
          <>
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setPracticeSummary(null);
                startRecording();
              }}
            >
              {t('practiceAgain')}
            </Button>
            <IconButton
              color="inherit"
              size="small"
              aria-label={t('close')}
              onClick={() => setPracticeSummary(null)}
            >
              <Close fontSize="small" />
            </IconButton>
          </>
        }
      />
      <EditorDrawer
        open={editOpen}
        onHeightChange={setDrawerHeight}
        readOnly={readOnly}
        abcMusic={abcMusic}
        onAbcChange={setAbcMusic}
        voices={voices}
        selectedVoiceIdx={selectedVoiceIdx}
        onVoiceChange={setSelectedVoiceIdx}
        parseError={currentParseError}
      />
    </>
  );
}
