import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotePlayer } from './NotePlayer';
import { Music, Note, Duration } from '../music';
import { fromAbc } from '../io/abcImport';

describe('NotePlayer', () => {
  let player: NotePlayer;

  beforeEach(() => {
    player = new NotePlayer();
  });

  /** Populate the expanded note/curve arrays from a Music object so enqueueNote can be called directly. */
  function setupExpanded(p: NotePlayer, music: Music) {
    p.expandedNotes = [...music.notes];
    p.expandedCurves = [...music.curves];
  }

  afterEach(() => {
    if (player.active) player.stop();
  });

  describe('start / stop', () => {
    it('creates AudioContext and activates player on start()', () => {
      player.start();
      expect(player.active).toBe(true);
      expect(player.audioCtx).toBeDefined();
      expect(player.masterGain).toBeDefined();
    });

    it('resets note tracking state on start()', () => {
      player.start();
      expect(player.lastNoteIx).toBe(-1);
      expect(player.lastNoteTime).toBe(player.audioCtx!.currentTime);
    });

    it('deactivates player and clears AudioContext on stop()', () => {
      player.start();
      player.stop();
      expect(player.active).toBe(false);
      expect(player.audioCtx).toBeUndefined();
      expect(player.masterGain).toBeUndefined();
    });
  });

  describe('setVolume', () => {
    it('clamps negative values to 0', () => {
      player.setVolume(-0.5);
      expect(player.masterGainValue).toBe(0);
    });

    it('clamps values above 1 to 1', () => {
      player.setVolume(1.5);
      expect(player.masterGainValue).toBe(1);
    });

    it('sets volume within [0, 1] range', () => {
      player.setVolume(0.6);
      expect(player.masterGainValue).toBe(0.6);
    });

    it('updates masterGain.gain.value when player is running', () => {
      player.start();
      player.setVolume(0.3);
      expect(player.masterGain!.gain.value).toBe(0.3);
    });
  });

  describe('scheduleNotes', () => {
    it('does nothing when player is not active', () => {
      const spy = vi.spyOn(player, 'enqueueTock');
      player.scheduleNotes(120);
      expect(spy).not.toHaveBeenCalled();
    });

    it('enqueues metronome tocks when no music is given', () => {
      player.start();
      const spy = vi.spyOn(player, 'enqueueTock');
      // 120 BPM, lookForward=1s: 0.5s per beat → 2 tocks fill the window
      player.scheduleNotes(120);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('creates oscillators for each pitched note in the lookahead window', () => {
      player.start();
      const createOscSpy = vi.spyOn(player.audioCtx!, 'createOscillator');

      const music = new Music();
      music.notes = [
        new Note(69, Duration.QUARTER, []), // A4 quarter note
        new Note(71, Duration.QUARTER, []), // B4 quarter note
      ];
      // At 120 BPM, each quarter note = 0.5s, lookForward=1s covers both
      player.scheduleNotes(120, music);

      expect(createOscSpy).toHaveBeenCalledTimes(6); // 3 harmonics per pitched note × 2 notes
    });

    it('sets active=false when called after all notes have been scheduled', () => {
      player.start();

      const music = new Music();
      music.notes = [new Note(69, Duration.QUARTER, [])];
      player.lastNoteIx = music.notes.length; // simulate all notes played

      player.scheduleNotes(120, music);

      expect(player.active).toBe(false);
    });

    it('does not loop forever when all notes fit within the lookahead window', () => {
      player.start();

      const music = new Music();
      // Single short note — total duration (~0.5s at 120 BPM) < lookForward (1.0s)
      music.notes = [new Note(69, Duration.QUARTER, [])];

      // This would hang without the inner guard in scheduleNotes
      player.scheduleNotes(120, music);

      expect(player.active).toBe(false);
      expect(player.lastNoteIx).toBeGreaterThanOrEqual(music.notes.length);
    });
  });

  describe('enqueueNote', () => {
    it('does not create an oscillator for a rest note', () => {
      player.start();
      const createOscSpy = vi.spyOn(player.audioCtx!, 'createOscillator');

      const music = new Music();
      music.notes = [new Note(undefined, Duration.QUARTER, [])]; // rest

      setupExpanded(player, music);
      player.enqueueNote(120, 4);

      expect(createOscSpy).not.toHaveBeenCalled();
    });

    it('applies dynamics decoration to the note gain node', () => {
      player.start();

      const noteGains: GainNode[] = [];
      const origCreateGain = player.audioCtx!.createGain.bind(player.audioCtx);
      vi.spyOn(player.audioCtx!, 'createGain').mockImplementation(() => {
        const gain = origCreateGain();
        noteGains.push(gain);
        return gain;
      });

      const music = new Music();
      music.notes = [new Note(69, Duration.QUARTER, ['pp'])]; // pp = 0.3

      setupExpanded(player, music);
      player.enqueueNote(120, 4);

      expect(noteGains[0].gain.value).toBe(0.3);
    });

    it('uses default gain of 0.7 when no dynamics decoration is present', () => {
      player.start();

      const noteGains: GainNode[] = [];
      const origCreateGain = player.audioCtx!.createGain.bind(player.audioCtx);
      vi.spyOn(player.audioCtx!, 'createGain').mockImplementation(() => {
        const gain = origCreateGain();
        noteGains.push(gain);
        return gain;
      });

      const music = new Music();
      music.notes = [new Note(69, Duration.QUARTER, [])];

      setupExpanded(player, music);
      player.enqueueNote(120, 4);

      expect(noteGains[0].gain.value).toBe(0.7);
    });
  });

  describe('ties', () => {
    it('produces oscillators only for the first note of a tie, not the continuation', () => {
      player.start();
      const createOscSpy = vi.spyOn(player.audioCtx!, 'createOscillator');

      const music = new Music();
      // Two quarter C4s tied together
      music.notes = [
        new Note(60, Duration.QUARTER, []),
        new Note(60, Duration.QUARTER, []),
      ];
      music.curves = [[0, 1]]; // tie

      setupExpanded(player, music);
      player.enqueueNote(120, 4); // note 0 — should create 3 oscillators
      player.enqueueNote(120, 4); // note 1 — tie continuation, no oscillators

      expect(createOscSpy).toHaveBeenCalledTimes(3); // 3 harmonics for note 0 only
    });

    it('schedules the tie-start oscillator for the combined duration', () => {
      player.start();

      const oscStops: number[] = [];
      const origCreate = player.audioCtx!.createOscillator.bind(
        player.audioCtx
      );
      vi.spyOn(player.audioCtx!, 'createOscillator').mockImplementation(() => {
        const osc = origCreate();
        const origStop = osc.stop.bind(osc);
        osc.stop = (when?: number) => {
          oscStops.push(when ?? 0);
          origStop(when);
        };
        return osc;
      });

      const music = new Music();
      music.notes = [
        new Note(60, Duration.QUARTER, []),
        new Note(60, Duration.QUARTER, []),
      ];
      music.curves = [[0, 1]];

      // At 120 BPM, quarter = 0.5 s; two tied quarters → 1.0 s total
      const startTime = player.audioCtx!.currentTime;
      setupExpanded(player, music);
      player.enqueueNote(120, 4);

      expect(
        oscStops.every((t) => Math.abs(t - (startTime + 1.0)) < 0.001)
      ).toBe(true);
    });

    it('advances cursor through tie continuation notes', () => {
      player.start();

      const music = new Music();
      music.notes = [
        new Note(60, Duration.QUARTER, []),
        new Note(60, Duration.QUARTER, []),
      ];
      music.curves = [[0, 1]];

      // Use scheduleNotes so a MusicTimeline is built for cursor tracking.
      // At 120 BPM, each quarter = 0.5 s; tie makes note 1 start at 0.5 s.
      player.scheduleNotes(120, music);

      // At t=0 cursor is at note 0; at t=0.75 s cursor is past note 1's start.
      expect(player.getNoteIdxAtTime(0)).toBe(0);
      expect(player.getNoteIdxAtTime(0.75)).toBeGreaterThan(1);
    });
  });

  it('handles ties parsed from ABC notation', () => {
    player.start();
    const createOscSpy = vi.spyOn(player.audioCtx!, 'createOscillator');

    const music = fromAbc('X:1\nT:Test\nM:C\nL:1/4\nK:C\nC-C |');

    // The ABC parser should produce 2 notes and a tie curve
    expect(music.notes).toHaveLength(2);
    expect(music.curves).toHaveLength(1);
    expect(music.curves[0]).toEqual([0, 1]);
    expect(music.notes[0].pitches).toEqual(music.notes[1].pitches);

    setupExpanded(player, music);
    player.enqueueNote(120, 4);
    player.enqueueNote(120, 4);

    // Only 3 oscillators (1 pitch × 3 harmonics), not 6
    expect(createOscSpy).toHaveBeenCalledTimes(3);
  });

  describe('repeat expansion in playback', () => {
    it('scheduleNotes expands repeats and uses original indices', () => {
      player.start();
      player.lookForward = 3.0; // wide enough window to schedule all 4 notes
      const music = new Music();
      music.notes = [
        new Note(60, Duration.QUARTER),
        new Note(62, Duration.QUARTER),
      ];
      music.bars = [
        { afterNoteNum: -1, type: 'begin_repeat' },
        { afterNoteNum: 1, type: 'end_repeat' },
      ];

      player.scheduleNotes(120, music);

      // Repeat expansion doubles the notes array.
      expect(player.expandedNotes).toHaveLength(4);
      // At 120 BPM each quarter = 0.5 s; second pass starts at 1.0 s.
      // At t=1.25 s the cursor should map back to original index 0 (≈0.5).
      expect(player.getNoteIdxAtTime(1.25)).toBeCloseTo(0.5, 1);
    });

    it('ties inside repeated section work on both passes', () => {
      player.start();
      const createOscSpy = vi.spyOn(player.audioCtx!, 'createOscillator');

      const music = new Music();
      // Two C4s tied inside a repeat
      music.notes = [
        new Note(60, Duration.QUARTER),
        new Note(60, Duration.QUARTER),
      ];
      music.curves = [[0, 1]];
      music.bars = [
        { afterNoteNum: -1, type: 'begin_repeat' },
        { afterNoteNum: 1, type: 'end_repeat' },
      ];

      player.scheduleNotes(120, music);

      // 4 expanded notes, but tied pairs → 3 harmonics per attack × 2 passes = 6
      expect(createOscSpy).toHaveBeenCalledTimes(6);
    });
  });

  describe('slurs', () => {
    it('produces oscillators for every note inside a slur', () => {
      player.start();
      const createOscSpy = vi.spyOn(player.audioCtx!, 'createOscillator');

      const music = new Music();
      // Slur over C4 → D4
      music.notes = [
        new Note(60, Duration.QUARTER, []),
        new Note(62, Duration.QUARTER, []),
      ];
      music.curves = [[0, 1]]; // slur (pitches differ)

      setupExpanded(player, music);
      player.enqueueNote(120, 4);
      player.enqueueNote(120, 4);

      // Both notes should produce oscillators: 3 harmonics × 2 notes = 6
      expect(createOscSpy).toHaveBeenCalledTimes(6);
    });
  });
});
