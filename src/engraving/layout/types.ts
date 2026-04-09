import type {
  Accidental,
  Annotation,
  BarLineType,
  Decoration,
  Duration,
  Signature,
  SpanDecorationType,
} from '../../music';

// ---------------------------------------------------------------------------
// Spatial constants (all in SVG user units / pixels)
// ---------------------------------------------------------------------------

export const STAFF_SPACE = 10; // distance between adjacent staff lines
export const STAFF_HEIGHT = 4 * STAFF_SPACE; // 5 lines = 4 spaces = 40px
export const BAR_TARGET_WIDTH = 320; // preferred measure width
export const BAR_HEIGHT = 120; // base vertical space per staff system
export const LYRICS_LINE_HEIGHT = 18; // extra height per lyrics verse
export const TOP_MARGIN = 30; // space above first system
export const LEFT_MARGIN = 15; // left edge padding
export const RIGHT_MARGIN = 15; // right edge padding
export const MIN_NOTE_SPACING = 20; // minimum horizontal gap between main notes
export const CLEF_WIDTH = 30; // space reserved for clef glyph
export const TIME_SIG_WIDTH = 20; // space reserved for time signature digits
export const KEY_SIG_ACCIDENTAL_WIDTH = 10; // space per accidental in key signature
export const NOTE_AREA_PADDING = 20; // padding between preamble and first note
export const REPEAT_BARLINE_GAP = 8; // extra gap before a begin-repeat barline that follows a preamble
export const STEM_LENGTH = 35; // 3.5 staff spaces
export const GRACE_NOTE_SPACING = 12; // horizontal space per grace note

// ---------------------------------------------------------------------------
// Intermediate types used during layout computation
// ---------------------------------------------------------------------------

/** Raw bar data from bar assignment — one entry per rendered bar. */
export interface BarData {
  barIndex: number;
  noteIndices: number[]; // indices into music.notes[], including grace notes
  /** Barline type at the END of this bar (drives right-edge rendering). */
  barLineType: BarLineType;
  /** Optional barline at the START of this bar (e.g. initial |:). */
  barLineStartType?: BarLineType;
  volta?: number;
  /** The active signature at the start of this bar. */
  signature: Signature;
}

/** Precomputed width budget for a single bar. */
export interface BarSizing {
  /** Preamble width when this bar is first on a line. */
  preambleIfFirst: number;
  /** Preamble width when this bar is not first on a line. */
  preambleIfNotFirst: number;
  /** True if the time signature changed from the previous bar. */
  timeSigChanged: boolean;
  /** Minimum width of the note area (prevents notes from overlapping). */
  minNoteAreaWidth: number;
  /** Total tick count (non-grace notes only) — used for proportional stretching. */
  totalTicks: number;
}

/** Final line assignment produced by line breaking. */
export interface LinePlan {
  /** Indices into the BarData array. */
  barIndices: number[];
  /** Final computed width for each bar (parallel to barIndices). */
  barWidths: number[];
  /** Absolute x position for each bar (parallel to barIndices). */
  barXs: number[];
}

// ---------------------------------------------------------------------------
// Layout result types (consumed by React components)
// ---------------------------------------------------------------------------

export interface LayoutResult {
  width: number;
  height: number;
  lineHeight: number;
  lines: LineLayout[];
}

export interface LineLayout {
  y: number; // absolute SVG y of the top staff line
  bars: BarLayout[];
  preambleBars: PreambleBarLayout[];
  ties: TieLayout[];
  tuplets: TupletLayout[];
  spanDecorations: SpanDecorationLayout[];
}

export interface SpanDecorationLayout {
  type: SpanDecorationType;
  startX: number;
  endX: number;
  y: number; // absolute SVG y for rendering
  lineIndex: number;
  isOpenEnd: boolean; // span continues off right edge (cross-line first half)
  isOpenStart: boolean; // span continues from left edge (cross-line second half)
}

/**
 * A pseudo-bar that renders a clef / key-sig / time-sig block.
 * Occupies horizontal space in the layout but contains no notes.
 * Used at the start of each line and at mid-line key-signature changes.
 */
export interface PreambleBarLayout {
  x: number;
  width: number;
  preamble: PreambleLayout;
}

export interface BarLayout {
  barIndex: number; // index into the original BarData array
  x: number; // left edge of bar (absolute SVG x)
  width: number; // total bar width
  preamble: PreambleLayout;
  noteAreaX: number; // absolute SVG x where notes begin
  noteAreaWidth: number; // width available for note spacing
  notes: NoteLayout[];
  beams: BeamLayout[]; // beams are always bar-local
  barlineStart: BarlineStartType;
  barlineEnd: BarlineEndType;
  volta?: VoltaSegment;
  isFirstOnLine: boolean;
  isFirstBar: boolean; // first bar of the piece (shows time sig)
}

export interface PreambleLayout {
  width: number;
  showClef: boolean;
  showKeySig: boolean;
  showTimeSig: boolean;
  numKeyAccidentals: number;
  accidentalType: 'sharp' | 'flat' | 'none';
  clefX: number; // relative to bar x
  keySigX: number; // relative to bar x (start of first accidental)
  timeSigX: number; // relative to bar x
  timeSig: string; // e.g. "4/4", "3/4"
}

export interface NoteLayout {
  musicNoteIndex: number; // index into music.notes[]
  x: number; // center of notehead (absolute SVG x)
  y: number; // reference notehead Y — top notehead if stem down, bottom if stem up
  staffPositions: number[]; // per-pitch staff position (0 = middle line, + = up)
  stemDirection: 'up' | 'down';
  stemStartY: number; // Y at the notehead end of the stem
  stemEndY: number; // Y at the flag/beam end of the stem
  duration: Duration;
  dots: number;
  accidentals: Accidental[];
  decorations: Decoration[];
  annotations: Annotation[];
  graceNotes: GraceNoteLayout[];
  lyrics: (string | undefined)[];
  isRest: boolean;
}

export interface GraceNoteLayout {
  musicNoteIndex: number;
  x: number; // center of grace notehead (absolute SVG x)
  y: number; // grace notehead Y
  staffPositions: number[];
  isSlash: boolean;
  accidentals: Accidental[];
}

export interface BeamLayout {
  /** Stave indices (into BarLayout.notes) of the beamed notes. */
  noteIndices: number[];
  /** Y at the beam end of each note's stem (parallel to noteIndices). */
  stemEndYs: number[];
  /** X of each stem (parallel to noteIndices). */
  stemXs: number[];
}

export interface TieLayout {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  /** Which staff line (index into LayoutResult.lines) this arc is drawn on. */
  lineIndex: number;
  curveDirection: 'above' | 'below';
  /** True if the tie extends to the right edge of the line (cross-line first half). */
  isOpenEnd: boolean;
  /** True if the tie starts from the left edge of the line (cross-line second half). */
  isOpenStart: boolean;
}

export interface TupletLayout {
  startX: number;
  endX: number;
  y: number; // Y of the bracket line
  num: number; // actual (p) — always shown
  written?: number; // shown only for non-standard ratios (e.g. "3:4")
  lineIndex: number;
}

/** A segment of a volta bracket on one staff line. */
export interface VoltaSegment {
  number: number; // e.g. 1 or 2
  type: 'begin' | 'mid' | 'end' | 'begin_end';
  /** Absolute SVG x of the left edge of this segment. */
  x: number;
  /** Width of this segment. */
  width: number;
}

// ---------------------------------------------------------------------------
// Barline types used in BarLayout
// ---------------------------------------------------------------------------

export type BarlineStartType = 'none' | 'begin_repeat';
export type BarlineEndType =
  | 'standard'
  | 'double'
  | 'end'
  | 'end_repeat'
  | 'begin_end_repeat';
