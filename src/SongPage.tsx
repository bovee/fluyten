import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
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
import ArrowBackIos from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIos from '@mui/icons-material/ArrowForwardIos';
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
import { findGrandStaffPair } from './io/grandStaff';
import {
  buildGrandStaffPracticeSequence,
  type PracticeEvent,
} from './practice/grandStaffSequence';
import { resolveInstrumentConfig, RECORDER_TYPES } from './instrument';
import { Music, expandRepeats, findNearestExpandedIndex } from './music';
import { SingleFrequencyTracker } from './audio/SingleFrequencyTracker';
import { MidiTracker } from './audio/MidiTracker';
import { NotePlayer } from './audio/NotePlayer';
import { getSynthProfileForGmInstrument } from './audio/synthProfiles';
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
/** Cursor sub-note quantization step: skip RAF setCursor calls whose noteIdx
 * rounds to the same bucket as the last one we pushed, so Score doesn't
 * re-render every frame for sub-note cursor motion. */
const CURSOR_QUANT = 0.1;

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

type OnCheck = (active: boolean, pitch: number | null) => void;
type PitchTracker = SingleFrequencyTracker | MidiTracker;

/**
 * Owns the shared input/tracker lifecycle for all checking modes: one
 * tracker (mic-based `SingleFrequencyTracker` or `MidiTracker`, depending on
 * the `useMidi` setting), one input permission, one AudioContext. Each mode
 * hook calls `start(onCheck)` to attach its detection callback and `stop()`
 * to tear down. `detectedPitch` and `isRecording` are surfaced here so the
 * call site can render them regardless of which mode is active.
 */
function useFreqTrackerSession(setStatusMessage: (msg: string) => void) {
  const { t } = useTranslation();
  const trackerRef = useRef<PitchTracker | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [detectedPitch, setDetectedPitch] = useState<number | null>(null);

  const start = async (onCheck: OnCheck): Promise<PitchTracker | null> => {
    if (trackerRef.current) return null;

    const {
      tuning,
      instrumentType,
      customBasePitchStr,
      customHighNoteStr,
      useMidi,
    } = useStore.getState();
    const config =
      resolveInstrumentConfig(
        instrumentType,
        customBasePitchStr,
        customHighNoteStr
      ) ?? RECORDER_TYPES.SOPRANO;

    const tracker: PitchTracker = useMidi
      ? new MidiTracker(RECORD_SAMPLE_RATE)
      : new SingleFrequencyTracker(RECORD_SAMPLE_RATE);
    tracker.onCheck = (active, pitch) => {
      setDetectedPitch(pitch);
      onCheck(active, pitch);
    };

    try {
      await tracker.start(config.basePitch, config.pitchRange, tuning);
    } catch (error) {
      tracker.stop();
      console.error('Failed to start recording:', error);
      alert(`Failed to start recording: ${(error as Error).message}`);
      return null;
    }

    trackerRef.current = tracker;
    setIsRecording(true);
    setStatusMessage(t('recordingStarted'));
    return tracker;
  };

  const stop = () => {
    if (!trackerRef.current) return;
    trackerRef.current.stop();
    trackerRef.current = null;
    setIsRecording(false);
    setDetectedPitch(null);
    setStatusMessage(t('recordingStopped'));
  };

  useEffect(() => () => trackerRef.current?.stop(), []);

  return { isRecording, detectedPitch, start, stop };
}

type FreqTrackerSession = ReturnType<typeof useFreqTrackerSession>;

function useAsPlayedChecking(
  session: FreqTrackerSession,
  expandedTrackingRef: React.RefObject<{
    notes: { pitches: number[] }[];
    originalIndices: number[];
    idx: number;
  }>,
  onFinish: (
    results: ReadonlyMap<number, 'correct' | 'wrong'>,
    correctCount: number,
    totalCount: number
  ) => void,
  grandStaffPracticeRef: React.RefObject<{
    events: PracticeEvent[];
    idx: number;
  } | null>
) {
  const [noteResults, setNoteResults] = useState<
    ReadonlyMap<number, 'correct' | 'wrong'>
  >(new Map());
  const [secondaryNoteResults, setSecondaryNoteResults] = useState<
    ReadonlyMap<number, 'correct' | 'wrong'>
  >(new Map());
  const [cursor, setCursor] = useState<number | undefined>();
  const noteResultsMapRef = useRef(new Map<number, 'correct' | 'wrong'>());
  const secondaryResultsMapRef = useRef(new Map<number, 'correct' | 'wrong'>());
  // True while the target note is currently sounding, so we count each note
  // onset only once even if the player holds the note across multiple polls.
  const wasActiveRef = useRef(false);

  const startRecording = async () => {
    if (session.isRecording) {
      session.stop();
      setCursor(undefined);
      return;
    }

    noteResultsMapRef.current = new Map();
    secondaryResultsMapRef.current = new Map();
    setNoteResults(new Map());
    setSecondaryNoteResults(new Map());
    const { tuning, useMidi } = useStore.getState();

    // Grand-staff MIDI path: iterate over PracticeEvents, each carrying the
    // expected pitches and original-note indices for both voices.
    const gsTracking = grandStaffPracticeRef.current;
    if (useMidi && gsTracking && gsTracking.events.length > 0) {
      gsTracking.idx = 0;
      // Skip leading events with no expected pitches in any voice.
      while (
        gsTracking.idx < gsTracking.events.length &&
        gsTracking.events[gsTracking.idx].expectedPitches.flat().length === 0
      )
        gsTracking.idx++;
      const setCursorForEvent = (e: PracticeEvent | undefined) => {
        if (!e) {
          setCursor(undefined);
          return;
        }
        // Cursor follows the treble's original index for this event; if the
        // treble has no onset, fall back to bass.
        const idx = e.originalIndices[0] ?? e.originalIndices[1];
        if (idx !== null && idx !== undefined) setCursor(idx);
      };
      setCursorForEvent(gsTracking.events[gsTracking.idx]);
      wasActiveRef.current = false;

      let tracker: PitchTracker | null = null;
      tracker = await session.start((active) => {
        if (!active) {
          wasActiveRef.current = false;
          return;
        }
        if (wasActiveRef.current) return;
        wasActiveRef.current = true;
        const t = grandStaffPracticeRef.current;
        if (!t) return;
        const event = t.events[t.idx];
        if (event) {
          // Mark each voice's note correct.
          for (let v = 0; v < event.originalIndices.length; v++) {
            const oi = event.originalIndices[v];
            if (oi === null) continue;
            const map =
              v === 0
                ? noteResultsMapRef.current
                : secondaryResultsMapRef.current;
            map.set(oi, 'correct');
          }
          setNoteResults(new Map(noteResultsMapRef.current));
          setSecondaryNoteResults(new Map(secondaryResultsMapRef.current));
        }
        t.idx++;
        while (
          t.idx < t.events.length &&
          t.events[t.idx].expectedPitches.flat().length === 0
        )
          t.idx++;
        if (t.idx >= t.events.length) {
          session.stop();
          setCursor(undefined);
          onFinish(
            new Map(noteResultsMapRef.current),
            t.events.length,
            t.events.length
          );
        } else {
          const next = t.events[t.idx];
          tracker?.setTarget(next.expectedPitches.flat(), tuning);
          setCursorForEvent(next);
        }
      });
      if (!tracker) return;
      const first = gsTracking.events[gsTracking.idx];
      if (first) tracker.setTarget(first.expectedPitches.flat(), tuning);
      return;
    }

    // Single-voice (existing) path.
    const tracking = expandedTrackingRef.current;
    tracking.idx = 0;
    while (
      tracking.idx < tracking.notes.length &&
      tracking.notes[tracking.idx].pitches.length === 0
    )
      tracking.idx++;
    setCursor(tracking.originalIndices[tracking.idx]);

    wasActiveRef.current = false;

    let tracker: PitchTracker | null = null;
    tracker = await session.start((active) => {
      if (!active) {
        wasActiveRef.current = false;
        return;
      }
      if (wasActiveRef.current) return;
      // Note onset: advance the cursor.
      wasActiveRef.current = true;
      const tracking = expandedTrackingRef.current;
      const originalIdx = tracking.originalIndices[tracking.idx];
      if (originalIdx !== undefined) {
        noteResultsMapRef.current.set(originalIdx, 'correct');
        setNoteResults(new Map(noteResultsMapRef.current));
      }
      tracking.idx++;
      while (
        tracking.idx < tracking.notes.length &&
        tracking.notes[tracking.idx].pitches.length === 0
      )
        tracking.idx++;
      if (tracking.idx >= tracking.notes.length) {
        session.stop();
        setCursor(undefined);
        onFinish(
          new Map(noteResultsMapRef.current),
          tracking.notes.length,
          tracking.notes.length
        );
      } else {
        tracker?.setTarget(tracking.notes[tracking.idx].pitches, tuning);
        setCursor(tracking.originalIndices[tracking.idx]);
      }
    });
    if (!tracker) return;
    const firstNote = tracking.notes[tracking.idx];
    if (firstNote) tracker.setTarget(firstNote.pitches, tuning);
  };

  return {
    startRecording,
    noteResults,
    secondaryNoteResults,
    cursor,
    countdown: null as number | null,
  };
}

function useInTempoChecking(
  session: FreqTrackerSession,
  musicRef: React.RefObject<Music>,
  tempoRef: React.RefObject<number>,
  onFinish: (
    results: ReadonlyMap<number, 'correct' | 'wrong'>,
    correctCount: number,
    totalCount: number
  ) => void,
  secondaryMusicRef: React.RefObject<Music | null>
) {
  const [noteResults, setNoteResults] = useState<
    ReadonlyMap<number, 'correct' | 'wrong'>
  >(new Map());
  const [secondaryNoteResults, setSecondaryNoteResults] = useState<
    ReadonlyMap<number, 'correct' | 'wrong'>
  >(new Map());
  const [cursor, setCursor] = useState<number | undefined>();
  const [countdown, setCountdown] = useState<number | null>(null);
  // Track the current note index (original) being evaluated, and whether the
  // correct pitch was detected at any point during that note's time window.
  const currentNoteIdxRef = useRef(-1);
  const bassCurrentNoteIdxRef = useRef(-1);
  const correctSeenRef = useRef(false);
  const bassCorrectSeenRef = useRef(false);
  const noteResultsMapRef = useRef(new Map<number, 'correct' | 'wrong'>());
  const secondaryResultsMapRef = useRef(new Map<number, 'correct' | 'wrong'>());
  const correctCountRef = useRef(0);
  const totalCountRef = useRef(0);
  const timelineRef = useRef<MusicTimeline | null>(null);
  const bassTimelineRef = useRef<MusicTimeline | null>(null);
  const rafRef = useRef<number | null>(null);
  const countdownTimeoutsRef = useRef<number[]>([]);
  const clickCtxRef = useRef<AudioContext | null>(null);

  const stopAll = () => {
    for (const id of countdownTimeoutsRef.current) clearTimeout(id);
    countdownTimeoutsRef.current = [];
    setCountdown(null);
    session.stop();
    clickCtxRef.current?.close();
    clickCtxRef.current = null;
    timelineRef.current = null;
    bassTimelineRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setCursor(undefined);
  };

  const startRecording = async () => {
    if (session.isRecording) {
      stopAll();
      return;
    }

    const { tuning, useMidi } = useStore.getState();
    const music = musicRef.current;
    const bassMusic = secondaryMusicRef.current;
    const useGrandStaff = useMidi && bassMusic !== null;

    correctSeenRef.current = false;
    bassCorrectSeenRef.current = false;
    const tracker = await session.start((active) => {
      if (!active) return;
      if (!useGrandStaff || !(tracker instanceof MidiTracker)) {
        correctSeenRef.current = true;
        return;
      }
      // Per-voice correctness: check whether held notes cover each voice's
      // current expected pitches independently.
      const held = tracker.getHeldNotes();
      const tIdx = currentNoteIdxRef.current;
      const bIdx = bassCurrentNoteIdxRef.current;
      const tPitches = tIdx >= 0 ? music.notes[tIdx]?.pitches : undefined;
      const bPitches = bIdx >= 0 ? bassMusic!.notes[bIdx]?.pitches : undefined;
      if (tPitches && tPitches.length > 0 && tPitches.every((p) => held.has(p)))
        correctSeenRef.current = true;
      if (bPitches && bPitches.length > 0 && bPitches.every((p) => held.has(p)))
        bassCorrectSeenRef.current = true;
    });
    if (!tracker) return;

    currentNoteIdxRef.current = -1;
    bassCurrentNoteIdxRef.current = -1;
    noteResultsMapRef.current = new Map();
    secondaryResultsMapRef.current = new Map();
    correctCountRef.current = 0;
    totalCountRef.current = 0;
    setNoteResults(new Map());
    setSecondaryNoteResults(new Map());

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
      const bassTimeline = useGrandStaff
        ? new MusicTimeline(bassMusic!, tempoRef.current)
        : null;
      if (bassTimeline) {
        bassTimeline.start();
        bassTimelineRef.current = bassTimeline;
      }

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
          if (useGrandStaff && bassMusic) {
            const bIdx = bassCurrentNoteIdxRef.current;
            const bNote = bassMusic.notes[bIdx];
            if (bIdx >= 0 && bNote && bNote.pitches.length > 0) {
              const r = bassCorrectSeenRef.current ? 'correct' : 'wrong';
              secondaryResultsMapRef.current.set(bIdx, r);
              setSecondaryNoteResults(new Map(secondaryResultsMapRef.current));
            }
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

        // Treble (primary): advance and re-target. In grand-staff mode the
        // tracker target gets the union of treble+bass expected pitches; in
        // single-voice mode just the treble's.
        let trebleAdvanced = false;
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
          currentNoteIdxRef.current = floorIdx;
          trebleAdvanced = true;
        }

        // Bass: independent timeline drives bass-side correctness.
        let bassAdvanced = false;
        if (bassTimeline) {
          const bNow = bassTimeline.getCurrentTime();
          const bIdx = Math.floor(bassTimeline.getNoteIdxAtTime(bNow));
          if (bIdx !== bassCurrentNoteIdxRef.current) {
            if (bassCurrentNoteIdxRef.current >= 0 && bassMusic) {
              const prevB = bassCurrentNoteIdxRef.current;
              const prevBNote = bassMusic.notes[prevB];
              if (prevBNote && prevBNote.pitches.length > 0) {
                const r = bassCorrectSeenRef.current ? 'correct' : 'wrong';
                secondaryResultsMapRef.current.set(prevB, r);
                setSecondaryNoteResults(
                  new Map(secondaryResultsMapRef.current)
                );
              }
              bassCorrectSeenRef.current = false;
            }
            bassCurrentNoteIdxRef.current = bIdx;
            bassAdvanced = true;
          }
        }

        // Refresh the tracker target whenever either voice advanced.
        if (trebleAdvanced || bassAdvanced) {
          const trebleNote = music.notes[currentNoteIdxRef.current];
          const tPitches =
            trebleNote && trebleNote.pitches.length > 0
              ? trebleNote.pitches
              : [];
          const bassNote =
            bassMusic && bassCurrentNoteIdxRef.current >= 0
              ? bassMusic.notes[bassCurrentNoteIdxRef.current]
              : undefined;
          const bPitches =
            bassNote && bassNote.pitches.length > 0 ? bassNote.pitches : [];
          const union = [...tPitches, ...bPitches];
          tracker.setTarget(union.length > 0 ? union : 0, tuning);
        }

        setCursor(Math.round(noteIdx / CURSOR_QUANT) * CURSOR_QUANT);
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
    }, beatMs * 3);

    countdownTimeoutsRef.current = [closeClick, id2, id1, id0];
  };

  // Cleanup on unmount. Stash in a ref so the unmount effect can stay
  // deps-free while still calling the latest `stopAll`.
  const stopAllRef = useRef(stopAll);
  useEffect(() => {
    stopAllRef.current = stopAll;
  });
  useEffect(() => () => stopAllRef.current(), []);

  return {
    startRecording,
    noteResults,
    secondaryNoteResults,
    cursor,
    countdown,
  };
}

type PlayerEntry = { player: NotePlayer; music: Music; voiceIdx: number };

function useAudioPlayback(
  voicesRef: React.RefObject<VoiceInfo[]>,
  selectedVoiceIdxRef: React.RefObject<number>,
  tempoRef: React.RefObject<number>,
  setStatusMessage: (msg: string) => void,
  grandStaffBassIdxRef: React.RefObject<number | null>
) {
  const { t } = useTranslation();
  const musicPlayersRef = useRef<PlayerEntry[]>([]);
  const cursorTimelineRef = useRef<MusicTimeline | null>(null);
  const musicPlayerInterval = useIntervalRef();
  const [cursor, setCursor] = useState<number | undefined>();
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

    const bassIdx = grandStaffBassIdxRef.current;
    const isSelected = (i: number) =>
      i === selectedIdx || (bassIdx !== null && i === bassIdx);

    // Only create audible players. The selected voice cursor is handled
    // separately by a MusicTimeline when that voice has no audible player.
    const entries: PlayerEntry[] = voices
      .map((v, i) => {
        const inPlaybackSet =
          playbackVoices === 'selected'
            ? isSelected(i)
            : playbackVoices === 'others'
              ? !isSelected(i)
              : true; // 'all'
        // %%MIDI voice mute silences a voice except when the user has
        // explicitly selected it — selecting always overrides the tune's hint.
        const muted = v.music.midiMute && !isSelected(i);
        if (!inPlaybackSet || muted) return null;
        const player = new NotePlayer();
        player.setProfile(
          getSynthProfileForGmInstrument(v.music.midiInstrument)
        );
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
        setCursor(
          Math.round(tl.getNoteIdxAtTime(tl.getCurrentTime()) / CURSOR_QUANT) *
            CURSOR_QUANT
        );
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
      setCursor(Math.round(noteIdx / CURSOR_QUANT) * CURSOR_QUANT);
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

  const seekToNoteImpl = (origNoteIdx: number) => {
    // Compute the time offset from the selected voice's expanded sequence.
    const selectedVoice = voicesRef.current[selectedVoiceIdxRef.current];
    if (!selectedVoice) return;

    const { entries } = expandRepeats(selectedVoice.music);
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
      for (let i = 0; i < entries.length; i++) {
        acc += lengthToTime(entries[i].note.ticks());
        if (acc > elapsed) {
          currentExpandedIdx = i;
          break;
        }
        if (i === entries.length - 1) currentExpandedIdx = i;
      }
    }

    const targetK = findNearestExpandedIndex(
      entries,
      origNoteIdx,
      currentExpandedIdx
    );
    if (targetK === -1) return;

    // Sum durations up to targetK to get the time offset.
    let startTimeOffset = 0;
    for (let i = 0; i < targetK; i++) {
      startTimeOffset += lengthToTime(entries[i].note.ticks());
    }

    // Stop current playback and restart from the computed offset.
    clearMusicPlayer();
    doStartPlaying(startTimeOffset);
  };
  // Stable ref-backed wrapper so Score's React.memo comparison passes when
  // onNoteClick is passed as a prop (avoids re-renders on every SongPage render).
  const seekToNoteImplRef = useRef(seekToNoteImpl);
  useEffect(() => {
    seekToNoteImplRef.current = seekToNoteImpl;
  });
  const seekToNote = useCallback(
    (origNoteIdx: number) => seekToNoteImplRef.current(origNoteIdx),
    []
  );

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
  onPrevSong?: () => void;
  onNextSong?: () => void;
}

export function SongPage({
  song,
  onBack,
  readOnly,
  onAbcChange,
  onPrevSong,
  onNextSong,
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
  const [editOpen, setEditOpen] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(0);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [abcMusic, setAbcMusic] = useState(song.abc);
  const [currentParseError, setCurrentParseError] = useState('');
  const [voices, setVoices] = useState<ReturnType<typeof voicesFromAbc>>([]);
  const [selectedVoiceIdx, setSelectedVoiceIdx] = useState(0);
  const [grandStaffActive, setGrandStaffActive] = useState(false);
  const fingeringSystem = useStore((s) => s.fingeringSystem);
  const grandStaffPair = useMemo(() => {
    if (fingeringSystem !== 'piano') return null;
    const pair = findGrandStaffPair(voices);
    if (!pair) return null;
    const trebleIdx = voices.indexOf(pair.treble);
    const bassIdx = voices.indexOf(pair.bass);
    if (trebleIdx === -1 || bassIdx === -1) return null;
    return { treble: pair.treble, bass: pair.bass, trebleIdx, bassIdx };
  }, [voices, fingeringSystem]);
  const music = useMemo(
    () =>
      voices[Math.min(selectedVoiceIdx, voices.length - 1)]?.music ??
      new Music(),
    [voices, selectedVoiceIdx]
  );
  const secondaryMusic = useMemo(
    () =>
      grandStaffActive && grandStaffPair
        ? grandStaffPair.bass.music
        : undefined,
    [grandStaffActive, grandStaffPair]
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
  const grandStaffActiveRef = useRef(grandStaffActive);
  useEffect(() => {
    grandStaffActiveRef.current = grandStaffActive;
  }, [grandStaffActive]);
  const grandStaffBassIdxRef = useRef<number | null>(null);
  useEffect(() => {
    grandStaffBassIdxRef.current = grandStaffPair?.bassIdx ?? null;
  }, [grandStaffPair]);

  // Auto-activate grand-staff mode when a pair first appears; deactivate when
  // it disappears (e.g. fingering switched away from piano). We track the
  // boolean transition, not the pair object identity — re-parsing the ABC
  // produces a new pair object but should NOT override the user's voice choice.
  const [hadPair, setHadPair] = useState(false);
  const hasPair = grandStaffPair !== null;
  if (hadPair !== hasPair) {
    setHadPair(hasPair);
    if (hasPair && grandStaffPair) {
      if (!grandStaffActive) setGrandStaffActive(true);
      if (selectedVoiceIdx !== grandStaffPair.trebleIdx)
        setSelectedVoiceIdx(grandStaffPair.trebleIdx);
    } else if (grandStaffActive) {
      setGrandStaffActive(false);
    }
  }
  const musicRef = useRef(music);
  useEffect(() => {
    musicRef.current = music;
  }, [music]);
  const secondaryMusicRef = useRef<Music | null>(secondaryMusic ?? null);
  useEffect(() => {
    secondaryMusicRef.current = secondaryMusic ?? null;
  }, [secondaryMusic]);
  const grandStaffPracticeRef = useRef<{
    events: PracticeEvent[];
    idx: number;
  } | null>(null);
  useEffect(() => {
    if (secondaryMusic) {
      grandStaffPracticeRef.current = {
        events: buildGrandStaffPracticeSequence([music, secondaryMusic]),
        idx: 0,
      };
    } else {
      grandStaffPracticeRef.current = null;
    }
  }, [music, secondaryMusic]);

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
      const prev = expanded.entries[i - 1].note;
      const curr = expanded.entries[i].note;
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
    for (let i = 0; i < expanded.entries.length; i++) {
      if (!isTieContinuation(i)) {
        notes.push(expanded.entries[i].note);
        originalIndices.push(expanded.entries[i].originalIndex);
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
  const onPracticeFinish = (
    results: ReadonlyMap<number, 'correct' | 'wrong'>,
    correctCount: number,
    totalCount: number
  ) => {
    if (totalCount > 0) {
      const pct = Math.round((correctCount / totalCount) * 100);
      useStore.getState().recordPracticeSession(song.id, pct);
      setPracticeSummary({ noteResults: results, correctCount, totalCount });
    }
  };

  const session = useFreqTrackerSession(setStatusMessage);

  const asPlayedResult = useAsPlayedChecking(
    session,
    expandedTrackingRef,
    onPracticeFinish,
    grandStaffPracticeRef
  );

  const inTempoResult = useInTempoChecking(
    session,
    musicRef,
    tempoRef,
    onPracticeFinish,
    secondaryMusicRef
  );

  const { detectedPitch, isRecording } = session;
  const {
    startRecording,
    noteResults,
    secondaryNoteResults,
    cursor: practiceCursor,
    countdown,
  } = practiceMode === 'in-tempo' ? inTempoResult : asPlayedResult;
  const {
    isPlaying,
    startPlaying,
    seekToNote,
    cursor: playbackCursor,
  } = useAudioPlayback(
    voicesRef,
    selectedVoiceIdxRef,
    tempoRef,
    setStatusMessage,
    grandStaffBassIdxRef
  );
  const { isMetronomeActive, startMetronome, stopMetronome } = useMetronome(
    tempoRef,
    setStatusMessage
  );

  const isPracticing = isMetronomeActive || isRecording;

  useEffect(() => {
    if (!isRecording) stopMetronome();
  }, [isRecording, stopMetronome]);

  // Re-parse when the ABC or clef/middle hints change. We adjust state during
  // render (rather than in an effect) so the new voices are visible in the
  // same render pass; on parse error we keep the previous voices so the score
  // doesn't blank out during transient mid-edit failures.
  const [parseInputs, setParseInputs] = useState<{
    abcMusic: string | null;
    defaultClef: Music['clef'];
    defaultMiddle: string | undefined;
  }>({ abcMusic: null, defaultClef, defaultMiddle });
  if (
    parseInputs.abcMusic !== abcMusic ||
    parseInputs.defaultClef !== defaultClef ||
    parseInputs.defaultMiddle !== defaultMiddle
  ) {
    setParseInputs({ abcMusic, defaultClef, defaultMiddle });
    try {
      const newVoices = voicesFromAbc(abcMusic, defaultClef, defaultMiddle);
      setVoices(newVoices);
      setCurrentParseError('');
      if (newVoices.every((v) => v.music.notes.length === 0)) setEditOpen(true);
    } catch (error) {
      setCurrentParseError((error as Error).message);
      setEditOpen(true);
    }
  }

  // Persist ABC edits to the store only when the user closes the editor
  // drawer, navigates away, or the component unmounts — not on every keystroke.
  // Store writes re-parse the ABC (for derived title/difficulty/etc.) and
  // serialize the whole store to localStorage, so keeping them off the hot
  // edit path avoids fan-pegging on long songs.
  const onAbcChangeRef = useRef(onAbcChange);
  useEffect(() => {
    onAbcChangeRef.current = onAbcChange;
  }, [onAbcChange]);
  const abcMusicRef = useRef(abcMusic);
  useEffect(() => {
    abcMusicRef.current = abcMusic;
  }, [abcMusic]);
  const lastPersistedAbcRef = useRef(song.abc);
  const flushAbc = useCallback(() => {
    if (readOnly) return;
    if (abcMusicRef.current === lastPersistedAbcRef.current) return;
    lastPersistedAbcRef.current = abcMusicRef.current;
    onAbcChangeRef.current?.(abcMusicRef.current);
  }, [readOnly]);

  const prevEditOpenRef = useRef(editOpen);
  useEffect(() => {
    if (prevEditOpenRef.current && !editOpen) flushAbc();
    prevEditOpenRef.current = editOpen;
  }, [editOpen, flushAbc]);

  useEffect(() => () => flushAbc(), [flushAbc]);

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
          onClick={() => {
            flushAbc();
            onBack();
          }}
          aria-label={t('backToSongList')}
          style={{ position: 'fixed', top: 8, left: 8 }}
          sx={{ displayPrint: 'none' }}
        >
          <ArrowBack />
        </IconButton>
      </Tooltip>
      <div
        style={{
          paddingLeft: '52px',
          paddingRight: '52px',
          paddingTop: '8px',
          textAlign: onPrevSong || onNextSong ? 'center' : undefined,
        }}
      >
        {onPrevSong && (
          <Tooltip title={t('prevSong')}>
            <IconButton
              onClick={onPrevSong}
              aria-label={t('prevSong')}
              size="small"
              sx={{ verticalAlign: 'middle', mb: '12px', mr: '4px' }}
            >
              <ArrowBackIos fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Typography
          variant="h4"
          component="h1"
          sx={{
            color: theme.palette.text.primary,
            display: 'inline',
            fontSize: { xs: '1.4rem', sm: '2rem', md: '2.125rem' },
            lineHeight: 1.2,
            wordBreak: 'break-word',
            fontFamily: "'EB Garamond', Georgia, serif",
          }}
        >
          {song.title}
        </Typography>
        {onNextSong && (
          <Tooltip title={t('nextSong')}>
            <IconButton
              onClick={onNextSong}
              aria-label={t('nextSong')}
              size="small"
              sx={{ verticalAlign: 'middle', mb: '12px', ml: '4px' }}
            >
              <ArrowForwardIos fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </div>
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
          secondaryMusic={secondaryMusic}
          width={scoreWidth}
          noteResults={isRecording ? noteResults : practiceSummary?.noteResults}
          secondaryNoteResults={isRecording ? secondaryNoteResults : undefined}
          cursor={isRecording ? practiceCursor : playbackCursor}
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
        onVoiceChange={(idx) => {
          setGrandStaffActive(false);
          setSelectedVoiceIdx(idx);
        }}
        grandStaffPair={
          grandStaffPair
            ? {
                trebleIdx: grandStaffPair.trebleIdx,
                bassIdx: grandStaffPair.bassIdx,
              }
            : undefined
        }
        grandStaffActive={grandStaffActive}
        onGrandStaffSelect={() => {
          if (!grandStaffPair) return;
          setSelectedVoiceIdx(grandStaffPair.trebleIdx);
          setGrandStaffActive(true);
        }}
        parseError={currentParseError}
      />
    </>
  );
}
