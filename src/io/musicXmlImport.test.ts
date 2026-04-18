import { describe, it, expect } from 'vitest';
import { fromMusicXml, extractMxl } from './musicXmlImport';
import { Duration, expandRepeats } from '../music';
import { zipSync } from 'fflate';

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

function makeScore(partsXml: string, meta = ''): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  ${meta}
  <part-list>
    <score-part id="P1"><part-name>Music</part-name></score-part>
  </part-list>
  <part id="P1">
    ${partsXml}
  </part>
</score-partwise>`;
}

function defaultAttrs(overrides = ''): string {
  return `<attributes>
    <divisions>4</divisions>
    <key><fifths>0</fifths></key>
    <time><beats>4</beats><beat-type>4</beat-type></time>
    <clef><sign>G</sign><line>2</line></clef>
    ${overrides}
  </attributes>`;
}

function measure(content: string, num = 1, attrOverride?: string): string {
  return `<measure number="${num}">
    ${attrOverride !== undefined ? attrOverride : defaultAttrs()}
    ${content}
  </measure>`;
}

function note(step: string, octave: number, type: string, extra = ''): string {
  const dur =
    { whole: 16, half: 8, quarter: 4, eighth: 2, '16th': 1 }[type] ?? 4;
  return `<note>
    <pitch><step>${step}</step><octave>${octave}</octave></pitch>
    <duration>${dur}</duration>
    <type>${type}</type>
    ${extra}
  </note>`;
}

function rest(type: string, extra = ''): string {
  const dur =
    { whole: 16, half: 8, quarter: 4, eighth: 2, '16th': 1 }[type] ?? 4;
  return `<note>
    <rest/>
    <duration>${dur}</duration>
    <type>${type}</type>
    ${extra}
  </note>`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fromMusicXml', () => {
  describe('metadata', () => {
    it('parses movement-title', () => {
      const xml = makeScore(
        measure(note('C', 4, 'whole')),
        '<movement-title>Ode to Joy</movement-title>'
      );
      expect(fromMusicXml(xml).title).toBe('Ode to Joy');
    });

    it('prefers work-title over movement-title', () => {
      const xml = makeScore(
        measure(note('C', 4, 'whole')),
        '<work><work-title>Symphony</work-title></work><movement-title>Allegro</movement-title>'
      );
      expect(fromMusicXml(xml).title).toBe('Symphony');
    });

    it('parses composer', () => {
      const xml = makeScore(
        measure(note('C', 4, 'whole')),
        '<identification><creator type="composer">J.S. Bach</creator></identification>'
      );
      expect(fromMusicXml(xml).composer).toBe('J.S. Bach');
    });

    it('returns empty title when none present', () => {
      const xml = makeScore(measure(note('C', 4, 'whole')));
      expect(fromMusicXml(xml).title).toBe('');
    });
  });

  describe('key signatures', () => {
    it.each([
      [-3, 'Eb'],
      [-1, 'F'],
      [0, 'C'],
      [1, 'G'],
      [2, 'D'],
      [6, 'F#'],
    ])('maps fifths=%i to key %s', (fifths, expectedKey) => {
      const xml = makeScore(`<measure number="1">
        <attributes>
          <divisions>4</divisions>
          <key><fifths>${fifths}</fifths></key>
          <time><beats>4</beats><beat-type>4</beat-type></time>
          <clef><sign>G</sign><line>2</line></clef>
        </attributes>
        ${note('C', 4, 'whole')}
      </measure>`);
      expect(fromMusicXml(xml).signatures[0].keySignature).toBe(expectedKey);
    });

    it('maps minor key correctly', () => {
      const xml = makeScore(`<measure number="1">
        <attributes>
          <divisions>4</divisions>
          <key><fifths>0</fifths><mode>minor</mode></key>
          <time><beats>4</beats><beat-type>4</beat-type></time>
          <clef><sign>G</sign><line>2</line></clef>
        </attributes>
        ${note('A', 4, 'whole')}
      </measure>`);
      expect(fromMusicXml(xml).signatures[0].keySignature).toBe('Am');
    });
  });

  describe('time signatures', () => {
    it('parses 3/4', () => {
      const xml = makeScore(`<measure number="1">
        <attributes>
          <divisions>4</divisions>
          <key><fifths>0</fifths></key>
          <time><beats>3</beats><beat-type>4</beat-type></time>
          <clef><sign>G</sign><line>2</line></clef>
        </attributes>
        ${note('C', 4, 'quarter')}${note('D', 4, 'quarter')}${note('E', 4, 'quarter')}
      </measure>`);
      const music = fromMusicXml(xml);
      expect(music.signatures[0].beatsPerBar).toBe(3);
      expect(music.signatures[0].beatValue).toBe(4);
    });

    it('parses common time symbol', () => {
      const xml = makeScore(`<measure number="1">
        <attributes>
          <divisions>4</divisions>
          <key><fifths>0</fifths></key>
          <time symbol="common"><beats>4</beats><beat-type>4</beat-type></time>
          <clef><sign>G</sign><line>2</line></clef>
        </attributes>
        ${note('C', 4, 'whole')}
      </measure>`);
      const music = fromMusicXml(xml);
      expect(music.signatures[0].beatsPerBar).toBe(4);
      expect(music.signatures[0].beatValue).toBe(4);
    });

    it('parses cut time symbol', () => {
      const xml = makeScore(`<measure number="1">
        <attributes>
          <divisions>4</divisions>
          <key><fifths>0</fifths></key>
          <time symbol="cut"><beats>2</beats><beat-type>2</beat-type></time>
          <clef><sign>G</sign><line>2</line></clef>
        </attributes>
        ${note('C', 4, 'half')}${note('G', 4, 'half')}
      </measure>`);
      const music = fromMusicXml(xml);
      expect(music.signatures[0].beatsPerBar).toBe(2);
      expect(music.signatures[0].beatValue).toBe(2);
    });
  });

  describe('clef', () => {
    it('parses treble clef (G)', () => {
      expect(fromMusicXml(makeScore(measure(note('C', 4, 'whole')))).clef).toBe(
        'treble'
      );
    });

    it('parses bass clef (F)', () => {
      const xml = makeScore(`<measure number="1">
        <attributes>
          <divisions>4</divisions>
          <key><fifths>0</fifths></key>
          <time><beats>4</beats><beat-type>4</beat-type></time>
          <clef><sign>F</sign><line>4</line></clef>
        </attributes>
        ${note('C', 3, 'whole')}
      </measure>`);
      expect(fromMusicXml(xml).clef).toBe('bass');
    });

    it('parses alto clef (C)', () => {
      const xml = makeScore(`<measure number="1">
        <attributes>
          <divisions>4</divisions>
          <key><fifths>0</fifths></key>
          <time><beats>4</beats><beat-type>4</beat-type></time>
          <clef><sign>C</sign><line>3</line></clef>
        </attributes>
        ${note('C', 4, 'whole')}
      </measure>`);
      expect(fromMusicXml(xml).clef).toBe('alto');
    });
  });

  describe('note pitches', () => {
    it('parses C4 as MIDI 60', () => {
      const music = fromMusicXml(makeScore(measure(note('C', 4, 'quarter'))));
      expect(music.notes[0].pitches[0]).toBe(60);
    });

    it('parses A4 as MIDI 69', () => {
      const music = fromMusicXml(makeScore(measure(note('A', 4, 'quarter'))));
      expect(music.notes[0].pitches[0]).toBe(69);
    });

    it('parses sharp (alter=1)', () => {
      const xml = makeScore(
        measure(`<note>
        <pitch><step>F</step><alter>1</alter><octave>4</octave></pitch>
        <duration>4</duration><type>quarter</type>
        <accidental>sharp</accidental>
      </note>`)
      );
      const music = fromMusicXml(xml);
      expect(music.notes[0].pitches[0]).toBe(66); // F#4
      expect(music.notes[0].accidentals[0]).toBe('#');
    });

    it('parses flat (alter=-1)', () => {
      const xml = makeScore(
        measure(`<note>
        <pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch>
        <duration>4</duration><type>quarter</type>
        <accidental>flat</accidental>
      </note>`)
      );
      const music = fromMusicXml(xml);
      expect(music.notes[0].pitches[0]).toBe(70); // Bb4
      expect(music.notes[0].accidentals[0]).toBe('b');
    });

    it('parses natural accidental', () => {
      const xml = makeScore(
        measure(`<note>
        <pitch><step>B</step><octave>4</octave></pitch>
        <duration>4</duration><type>quarter</type>
        <accidental>natural</accidental>
      </note>`)
      );
      const music = fromMusicXml(xml);
      expect(music.notes[0].accidentals[0]).toBe('n');
    });

    it('infers sharp accidental from alter without <accidental> element', () => {
      const xml = makeScore(
        measure(`<note>
        <pitch><step>C</step><alter>1</alter><octave>4</octave></pitch>
        <duration>4</duration><type>quarter</type>
      </note>`)
      );
      const music = fromMusicXml(xml);
      expect(music.notes[0].accidentals[0]).toBe('#');
    });
  });

  describe('rests', () => {
    it('parses a quarter rest', () => {
      const music = fromMusicXml(makeScore(measure(rest('quarter'))));
      expect(music.notes[0].pitches).toHaveLength(0);
      expect(music.notes[0].duration).toBe(Duration.QUARTER);
    });

    it('parses a whole rest', () => {
      const music = fromMusicXml(makeScore(measure(rest('whole'))));
      expect(music.notes[0].pitches).toHaveLength(0);
      expect(music.notes[0].duration).toBe(Duration.WHOLE);
    });
  });

  describe('note durations', () => {
    it.each([
      ['whole', Duration.WHOLE],
      ['half', Duration.HALF],
      ['quarter', Duration.QUARTER],
      ['eighth', Duration.EIGHTH],
      ['16th', Duration.SIXTEENTH],
      ['32nd', Duration.THIRTY_SECOND],
    ])('parses %s note', (type, expectedDur) => {
      const dur: Record<string, number> = {
        whole: 16,
        half: 8,
        quarter: 4,
        eighth: 2,
        '16th': 1,
        '32nd': 1,
      };
      const d = dur[type] ?? 4;
      const xml = makeScore(
        measure(`<note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>${d}</duration>
        <type>${type}</type>
      </note>`)
      );
      const music = fromMusicXml(xml);
      expect(music.notes[0].duration).toBe(expectedDur);
      expect(music.notes[0].dots).toBe(0);
    });

    it('parses dotted quarter', () => {
      const xml = makeScore(
        measure(`<note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>6</duration>
        <type>quarter</type>
        <dot/>
      </note>`)
      );
      const music = fromMusicXml(xml);
      expect(music.notes[0].duration).toBe(Duration.QUARTER);
      expect(music.notes[0].dots).toBe(1);
    });

    it('parses triplet eighth', () => {
      const xml = makeScore(
        measure(`
        <note>
          <pitch><step>C</step><octave>4</octave></pitch>
          <duration>2</duration><type>eighth</type>
          <time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>
        </note>
        <note>
          <pitch><step>D</step><octave>4</octave></pitch>
          <duration>2</duration><type>eighth</type>
          <time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>
        </note>
        <note>
          <pitch><step>E</step><octave>4</octave></pitch>
          <duration>2</duration><type>eighth</type>
          <time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>
        </note>
      `)
      );
      const music = fromMusicXml(xml);
      expect(music.notes[0].tuplet).toBeDefined();
      expect(music.notes[1].tuplet).toBeDefined();
      expect(music.notes[2].tuplet).toBeDefined();
    });

    it('parses grace note', () => {
      const xml = makeScore(
        measure(`
        <note>
          <grace/>
          <pitch><step>D</step><octave>4</octave></pitch>
          <type>eighth</type>
        </note>
        ${note('C', 4, 'quarter')}
      `)
      );
      const music = fromMusicXml(xml);
      expect(music.notes[0].duration).toBe(Duration.GRACE);
      expect(music.notes[1].duration).toBe(Duration.QUARTER);
    });

    it('parses grace slash note', () => {
      const xml = makeScore(
        measure(`
        <note>
          <grace slash="yes"/>
          <pitch><step>D</step><octave>4</octave></pitch>
          <type>eighth</type>
        </note>
        ${note('C', 4, 'quarter')}
      `)
      );
      const music = fromMusicXml(xml);
      expect(music.notes[0].duration).toBe(Duration.GRACE_SLASH);
    });
  });

  describe('multiple notes', () => {
    it('parses a sequence of notes', () => {
      const xml = makeScore(
        measure(
          note('C', 4, 'quarter') +
            note('D', 4, 'quarter') +
            note('E', 4, 'quarter') +
            note('F', 4, 'quarter')
        )
      );
      const music = fromMusicXml(xml);
      expect(music.notes).toHaveLength(4);
      expect(music.notes.map((n) => n.pitches[0])).toEqual([60, 62, 64, 65]);
    });

    it('skips voice 2 notes', () => {
      const xml = makeScore(
        measure(`
        ${note('C', 5, 'half', '<voice>1</voice>')}
        <note>
          <chord/>
          <pitch><step>E</step><octave>4</octave></pitch>
          <duration>8</duration><type>half</type>
          <voice>1</voice>
        </note>
        <note>
          <pitch><step>G</step><octave>3</octave></pitch>
          <duration>8</duration><type>half</type>
          <voice>2</voice>
        </note>
      `)
      );
      const music = fromMusicXml(xml);
      // Voice 1 has one note (C5) with chord E4; voice 2 (G3) is skipped
      expect(music.notes).toHaveLength(1);
      expect(music.notes[0].pitches[0]).toBe(72); // C5
    });
  });

  describe('chords', () => {
    it('adds chord pitches to previous note', () => {
      const xml = makeScore(
        measure(`
        ${note('C', 4, 'quarter')}
        <note>
          <chord/>
          <pitch><step>E</step><octave>4</octave></pitch>
          <duration>4</duration><type>quarter</type>
        </note>
        <note>
          <chord/>
          <pitch><step>G</step><octave>4</octave></pitch>
          <duration>4</duration><type>quarter</type>
        </note>
      `)
      );
      const music = fromMusicXml(xml);
      expect(music.notes).toHaveLength(1);
      expect(music.notes[0].pitches).toEqual([60, 64, 67]);
    });
  });

  describe('bar lines', () => {
    it('adds standard barlines between measures', () => {
      const xml = makeScore(
        measure(note('C', 4, 'whole'), 1) +
          measure(note('D', 4, 'whole'), 2, '') +
          measure(note('E', 4, 'whole'), 3, '')
      );
      const music = fromMusicXml(xml);
      expect(music.notes).toHaveLength(3);
      // Should have barlines after each measure
      const types = music.bars.map((b) => b.type);
      expect(types).toContain('standard');
    });

    it('uses end barline for light-heavy', () => {
      const xml = makeScore(
        measure(`
        ${note('C', 4, 'whole')}
        <barline location="right">
          <bar-style>light-heavy</bar-style>
        </barline>
      `)
      );
      const music = fromMusicXml(xml);
      expect(music.bars.at(-1)?.type).toBe('end');
    });

    it('uses double barline for light-light', () => {
      const xml = makeScore(
        measure(`
        ${note('C', 4, 'whole')}
        <barline location="right">
          <bar-style>light-light</bar-style>
        </barline>
      `)
      );
      const music = fromMusicXml(xml);
      expect(music.bars.at(-1)?.type).toBe('double');
    });

    it('parses end_repeat barline', () => {
      const xml = makeScore(
        measure(`
        ${note('C', 4, 'whole')}
        <barline location="right">
          <bar-style>light-heavy</bar-style>
          <repeat direction="backward"/>
        </barline>
      `)
      );
      const music = fromMusicXml(xml);
      expect(music.bars.at(-1)?.type).toBe('end_repeat');
    });

    it('parses begin_repeat left barline', () => {
      const xml = makeScore(
        measure(note('C', 4, 'whole'), 1) +
          `<measure number="2">
          <barline location="left">
            <bar-style>heavy-light</bar-style>
            <repeat direction="forward"/>
          </barline>
          ${note('D', 4, 'whole')}
        </measure>`
      );
      const music = fromMusicXml(xml);
      const types = music.bars.map((b) => b.type);
      expect(types).toContain('begin_repeat');
    });

    it('merges adjacent end_repeat + begin_repeat into begin_end_repeat', () => {
      const xml = makeScore(`
        <measure number="1">
          ${defaultAttrs()}
          ${note('C', 4, 'whole')}
          <barline location="right">
            <bar-style>light-heavy</bar-style>
            <repeat direction="backward"/>
          </barline>
        </measure>
        <measure number="2">
          <barline location="left">
            <bar-style>heavy-light</bar-style>
            <repeat direction="forward"/>
          </barline>
          ${note('D', 4, 'whole')}
        </measure>
      `);
      const music = fromMusicXml(xml);
      const types = music.bars.map((b) => b.type);
      expect(types).toContain('begin_end_repeat');
      expect(types).not.toContain('end_repeat');
    });

    describe('volta brackets', () => {
      // Build XML for: |: C D E F |1 G A B c :|2 d e f g |]
      // measure 1: |: with C D E F
      // measure 2: first ending G A B c, ends with :|
      // measure 3: second ending d e f g, ends with |]
      function voltaXml(): string {
        return makeScore(`
          <measure number="1">
            ${defaultAttrs()}
            <barline location="left">
              <bar-style>heavy-light</bar-style>
              <repeat direction="forward"/>
            </barline>
            ${note('C', 4, 'quarter')}
            ${note('D', 4, 'quarter')}
            ${note('E', 4, 'quarter')}
            ${note('F', 4, 'quarter')}
          </measure>
          <measure number="2">
            <barline location="left">
              <ending number="1" type="start"/>
            </barline>
            ${note('G', 4, 'quarter')}
            ${note('A', 4, 'quarter')}
            ${note('B', 4, 'quarter')}
            ${note('C', 5, 'quarter')}
            <barline location="right">
              <bar-style>light-heavy</bar-style>
              <repeat direction="backward"/>
              <ending number="1" type="stop"/>
            </barline>
          </measure>
          <measure number="3">
            <barline location="left">
              <ending number="2" type="start"/>
            </barline>
            ${note('D', 5, 'quarter')}
            ${note('E', 5, 'quarter')}
            ${note('F', 5, 'quarter')}
            ${note('G', 5, 'quarter')}
            <barline location="right">
              <bar-style>light-heavy</bar-style>
              <ending number="2" type="stop"/>
            </barline>
          </measure>
        `);
      }

      it('attaches volta:1 to the bar before the first ending', () => {
        const music = fromMusicXml(voltaXml());
        const volta1Bars = music.bars.filter((b) => b.volta === 1);
        expect(volta1Bars).toHaveLength(1);
        expect(volta1Bars[0].type).toBe('standard');
        // The bar after note index 3 (F) should have volta:1
        expect(volta1Bars[0].afterNoteNum).toBe(3);
      });

      it('attaches volta:2 to the end_repeat bar before the second ending', () => {
        const music = fromMusicXml(voltaXml());
        const volta2Bars = music.bars.filter((b) => b.volta === 2);
        expect(volta2Bars).toHaveLength(1);
        expect(volta2Bars[0].type).toBe('end_repeat');
        // The end_repeat bar is after note index 7 (c5)
        expect(volta2Bars[0].afterNoteNum).toBe(7);
      });

      it('expandRepeats plays common+volta1 then common+volta2', () => {
        const music = fromMusicXml(voltaXml());
        const result = expandRepeats(music);
        // Pass 1: C D E F G A B c  (8 notes)
        // Pass 2: C D E F d e f g  (8 notes)
        expect(result.notes).toHaveLength(16);
        expect(result.notes[0].pitches[0]).toBe(60); // C4
        expect(result.notes[4].pitches[0]).toBe(67); // G4 (volta 1)
        expect(result.notes[8].pitches[0]).toBe(60); // C4 (repeated common)
        expect(result.notes[12].pitches[0]).toBe(74); // D5 (volta 2)
      });
    });
  });

  describe('ties and slurs', () => {
    it('creates a single curve for a simple two-note tie', () => {
      const xml = makeScore(
        measure(`
        <note>
          <pitch><step>C</step><octave>4</octave></pitch>
          <duration>8</duration><type>half</type>
          <tie type="start"/>
        </note>
        <note>
          <pitch><step>C</step><octave>4</octave></pitch>
          <duration>4</duration><type>quarter</type>
          <tie type="stop"/>
        </note>
        ${note('G', 4, 'quarter')}
      `)
      );
      const music = fromMusicXml(xml);
      expect(music.notes).toHaveLength(3);
      expect(music.curves).toEqual([[0, 1]]);
    });

    it('collapses a chained tie (3 notes) into a single curve', () => {
      // Without collapsing, [0,1] + [1,2] would produce (d (d) d) — nested parens.
      // With collapsing, the chain becomes one curve [0,2] → (d d d).
      const xml = makeScore(
        measure(`
        <note>
          <pitch><step>E</step><octave>4</octave></pitch>
          <duration>4</duration><type>quarter</type>
          <tie type="start"/>
        </note>
        <note>
          <pitch><step>E</step><octave>4</octave></pitch>
          <duration>4</duration><type>quarter</type>
          <tie type="stop"/>
          <tie type="start"/>
        </note>
        <note>
          <pitch><step>E</step><octave>4</octave></pitch>
          <duration>4</duration><type>quarter</type>
          <tie type="stop"/>
        </note>
        ${note('G', 4, 'quarter')}
      `)
      );
      const music = fromMusicXml(xml);
      expect(music.notes).toHaveLength(4);
      expect(music.curves).toEqual([[0, 2]]);
    });

    it('creates a curve for slurred notes', () => {
      const xml = makeScore(
        measure(`
        <note>
          <pitch><step>C</step><octave>4</octave></pitch>
          <duration>4</duration><type>quarter</type>
          <notations><slur type="start" number="1"/></notations>
        </note>
        <note>
          <pitch><step>D</step><octave>4</octave></pitch>
          <duration>4</duration><type>quarter</type>
          <notations><slur type="stop" number="1"/></notations>
        </note>
        ${note('E', 4, 'half')}
      `)
      );
      const music = fromMusicXml(xml);
      expect(music.curves).toEqual([[0, 1]]);
    });
  });

  describe('decorations', () => {
    it('parses staccato', () => {
      const xml = makeScore(
        measure(`
        <note>
          <pitch><step>C</step><octave>4</octave></pitch>
          <duration>4</duration><type>quarter</type>
          <notations><articulations><staccato/></articulations></notations>
        </note>
      `)
      );
      expect(fromMusicXml(xml).notes[0].decorations).toContain('staccato');
    });

    it('parses accent', () => {
      const xml = makeScore(
        measure(`
        <note>
          <pitch><step>C</step><octave>4</octave></pitch>
          <duration>4</duration><type>quarter</type>
          <notations><articulations><accent/></articulations></notations>
        </note>
      `)
      );
      expect(fromMusicXml(xml).notes[0].decorations).toContain('accent');
    });

    it('parses fermata', () => {
      const xml = makeScore(
        measure(`
        <note>
          <pitch><step>C</step><octave>4</octave></pitch>
          <duration>16</duration><type>whole</type>
          <notations><fermata/></notations>
        </note>
      `)
      );
      expect(fromMusicXml(xml).notes[0].decorations).toContain('fermata');
    });

    it('parses trill', () => {
      const xml = makeScore(
        measure(`
        <note>
          <pitch><step>C</step><octave>4</octave></pitch>
          <duration>16</duration><type>whole</type>
          <notations><ornaments><trill-mark/></ornaments></notations>
        </note>
      `)
      );
      expect(fromMusicXml(xml).notes[0].decorations).toContain('trill');
    });

    it('parses tenuto', () => {
      const xml = makeScore(
        measure(`
        <note>
          <pitch><step>C</step><octave>4</octave></pitch>
          <duration>4</duration><type>quarter</type>
          <notations><articulations><tenuto/></articulations></notations>
        </note>
      `)
      );
      expect(fromMusicXml(xml).notes[0].decorations).toContain('tenuto');
    });
  });

  describe('beams', () => {
    it('creates beam groups from beam elements', () => {
      const xml = makeScore(
        measure(`
        <note>
          <pitch><step>C</step><octave>4</octave></pitch>
          <duration>2</duration><type>eighth</type>
          <beam number="1">begin</beam>
        </note>
        <note>
          <pitch><step>D</step><octave>4</octave></pitch>
          <duration>2</duration><type>eighth</type>
          <beam number="1">continue</beam>
        </note>
        <note>
          <pitch><step>E</step><octave>4</octave></pitch>
          <duration>2</duration><type>eighth</type>
          <beam number="1">end</beam>
        </note>
      `)
      );
      const music = fromMusicXml(xml);
      expect(music.beams).toEqual([[0, 2]]);
    });

    it('handles notes without beam elements without crashing', () => {
      // Mix of unbeamed quarter notes and beamed eighth notes in the same measure
      const xml = makeScore(
        measure(`
        ${note('C', 4, 'quarter')}
        <note>
          <pitch><step>D</step><octave>4</octave></pitch>
          <duration>2</duration><type>eighth</type>
          <beam number="1">begin</beam>
        </note>
        <note>
          <pitch><step>E</step><octave>4</octave></pitch>
          <duration>2</duration><type>eighth</type>
          <beam number="1">end</beam>
        </note>
        ${note('F', 4, 'quarter')}
      `)
      );
      const music = fromMusicXml(xml);
      expect(music.notes).toHaveLength(4);
      expect(music.beams).toEqual([[1, 2]]);
    });

    it('handles multiple beam groups in one measure', () => {
      const xml = makeScore(
        measure(`
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type><beam number="1">begin</beam></note>
        <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type><beam number="1">end</beam></note>
        ${note('E', 4, 'quarter')}
        <note><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type><beam number="1">begin</beam></note>
        <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><type>eighth</type><beam number="1">end</beam></note>
      `)
      );
      const music = fromMusicXml(xml);
      expect(music.beams).toEqual([
        [0, 1],
        [3, 4],
      ]);
    });
  });

  describe('multi-measure', () => {
    it('parses multiple measures correctly', () => {
      const xml = makeScore(
        measure(
          note('C', 4, 'quarter') +
            note('D', 4, 'quarter') +
            note('E', 4, 'quarter') +
            note('F', 4, 'quarter'),
          1
        ) +
          `<measure number="2">
          ${note('G', 4, 'quarter')}
          ${note('A', 4, 'quarter')}
          ${note('B', 4, 'quarter')}
          ${note('C', 5, 'quarter')}
        </measure>`
      );
      const music = fromMusicXml(xml);
      expect(music.notes).toHaveLength(8);
      expect(music.notes[4].pitches[0]).toBe(67); // G4
      expect(music.notes[7].pitches[0]).toBe(72); // C5
    });

    it('inherits attributes from first measure when later measures omit them', () => {
      const xml = makeScore(
        measure(note('C', 4, 'whole'), 1) +
          `<measure number="2">
          ${note('D', 4, 'whole')}
        </measure>`
      );
      const music = fromMusicXml(xml);
      expect(music.signatures[0].beatsPerBar).toBe(4);
      expect(music.signatures[0].keySignature).toBe('C');
    });
  });

  describe('error handling', () => {
    it('throws on invalid XML', () => {
      expect(() => fromMusicXml('<this is not xml')).toThrow();
    });

    it('returns empty Music when no part is found', () => {
      const xml = `<?xml version="1.0"?>
        <score-partwise version="3.1">
          <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
        </score-partwise>`;
      const music = fromMusicXml(xml);
      expect(music.notes).toHaveLength(0);
    });
  });

  describe('tempo', () => {
    it('parses tempo from <sound tempo="...">', () => {
      const xml = makeScore(`<measure number="1">
        ${defaultAttrs()}
        <direction>
          <direction-type><words>Allegro</words></direction-type>
          <sound tempo="132"/>
        </direction>
        ${note('C', 4, 'whole')}
      </measure>`);
      const music = fromMusicXml(xml);
      expect(music.signatures[0].tempo).toBe(132);
      expect(music.signatures[0].tempoText).toBe('Allegro');
    });

    it('parses tempo without text label', () => {
      const xml = makeScore(`<measure number="1">
        ${defaultAttrs()}
        <direction><sound tempo="90"/></direction>
        ${note('C', 4, 'whole')}
      </measure>`);
      const music = fromMusicXml(xml);
      expect(music.signatures[0].tempo).toBe(90);
      expect(music.signatures[0].tempoText).toBeUndefined();
    });

    it('creates a new signature for a mid-piece tempo change', () => {
      const xml = makeScore(
        measure(note('C', 4, 'whole')) +
          `<measure number="2">
          ${defaultAttrs()}
          <direction><sound tempo="60"/></direction>
          ${note('D', 4, 'whole')}
        </measure>`
      );
      const music = fromMusicXml(xml);
      expect(music.signatures).toHaveLength(2);
      expect(music.signatures[1].tempo).toBe(60);
      expect(music.signatures[1].atNoteIndex).toBe(1);
    });
  });

  describe('mid-piece signature changes', () => {
    it('creates a new key signature entry for a mid-piece key change', () => {
      const xml = makeScore(
        measure(note('C', 4, 'whole')) +
          `<measure number="2">
          <attributes>
            <divisions>4</divisions>
            <key><fifths>1</fifths></key>
            <time><beats>4</beats><beat-type>4</beat-type></time>
            <clef><sign>G</sign><line>2</line></clef>
          </attributes>
          ${note('G', 4, 'whole')}
        </measure>`
      );
      const music = fromMusicXml(xml);
      expect(music.signatures).toHaveLength(2);
      expect(music.signatures[0].keySignature).toBe('C');
      expect(music.signatures[1].keySignature).toBe('G');
      expect(music.signatures[1].atNoteIndex).toBe(1);
    });

    it('creates a new time signature entry for a mid-piece meter change', () => {
      const xml = makeScore(
        measure(
          note('C', 4, 'quarter') +
            note('D', 4, 'quarter') +
            note('E', 4, 'quarter') +
            note('F', 4, 'quarter')
        ) +
          `<measure number="2">
          <attributes>
            <divisions>4</divisions>
            <key><fifths>0</fifths></key>
            <time><beats>3</beats><beat-type>4</beat-type></time>
            <clef><sign>G</sign><line>2</line></clef>
          </attributes>
          ${note('G', 4, 'quarter')}${note('A', 4, 'quarter')}${note('B', 4, 'quarter')}
        </measure>`
      );
      const music = fromMusicXml(xml);
      expect(music.signatures).toHaveLength(2);
      expect(music.signatures[0].beatsPerBar).toBe(4);
      expect(music.signatures[1].beatsPerBar).toBe(3);
      expect(music.signatures[1].atNoteIndex).toBe(4);
    });

    it('sets commonTime flag for common time mid-piece change', () => {
      const xml = makeScore(
        measure(note('C', 4, 'whole')) +
          `<measure number="2">
          <attributes>
            <divisions>4</divisions>
            <key><fifths>0</fifths></key>
            <time symbol="common"><beats>4</beats><beat-type>4</beat-type></time>
            <clef><sign>G</sign><line>2</line></clef>
          </attributes>
          ${note('D', 4, 'whole')}
        </measure>`
      );
      const music = fromMusicXml(xml);
      expect(music.signatures[1].commonTime).toBe(true);
    });
  });

  describe('clef octave transposition', () => {
    it('parses treble+8 clef (clef-octave-change=1)', () => {
      const xml = makeScore(`<measure number="1">
        <attributes>
          <divisions>4</divisions>
          <key><fifths>0</fifths></key>
          <time><beats>4</beats><beat-type>4</beat-type></time>
          <clef><sign>G</sign><line>2</line><clef-octave-change>1</clef-octave-change></clef>
        </attributes>
        ${note('C', 4, 'whole')}
      </measure>`);
      expect(fromMusicXml(xml).clef).toBe('treble8va');
    });

    it('parses bass+8 clef (clef-octave-change=1 on F clef)', () => {
      const xml = makeScore(`<measure number="1">
        <attributes>
          <divisions>4</divisions>
          <key><fifths>0</fifths></key>
          <time><beats>4</beats><beat-type>4</beat-type></time>
          <clef><sign>F</sign><line>4</line><clef-octave-change>1</clef-octave-change></clef>
        </attributes>
        ${note('C', 3, 'whole')}
      </measure>`);
      expect(fromMusicXml(xml).clef).toBe('bass8va');
    });
  });

  describe('span decorations', () => {
    it('parses a crescendo wedge', () => {
      const xml = makeScore(`<measure number="1">
        ${defaultAttrs()}
        <direction>
          <direction-type><wedge type="crescendo" number="1"/></direction-type>
        </direction>
        ${note('C', 4, 'quarter')}
        ${note('D', 4, 'quarter')}
        <direction>
          <direction-type><wedge type="stop" number="1"/></direction-type>
        </direction>
        ${note('E', 4, 'half')}
      </measure>`);
      const music = fromMusicXml(xml);
      expect(music.spanDecorations).toHaveLength(1);
      expect(music.spanDecorations[0].type).toBe('crescendo');
      expect(music.spanDecorations[0].startNoteIndex).toBe(0);
      expect(music.spanDecorations[0].endNoteIndex).toBe(1);
    });

    it('parses a diminuendo wedge', () => {
      const xml = makeScore(`<measure number="1">
        ${defaultAttrs()}
        <direction>
          <direction-type><wedge type="diminuendo" number="1"/></direction-type>
        </direction>
        ${note('E', 4, 'quarter')}
        ${note('D', 4, 'quarter')}
        <direction>
          <direction-type><wedge type="stop" number="1"/></direction-type>
        </direction>
        ${note('C', 4, 'half')}
      </measure>`);
      const music = fromMusicXml(xml);
      expect(music.spanDecorations[0].type).toBe('diminuendo');
    });

    it('closes unclosed wedge at end of piece', () => {
      const xml = makeScore(`<measure number="1">
        ${defaultAttrs()}
        <direction>
          <direction-type><wedge type="crescendo" number="1"/></direction-type>
        </direction>
        ${note('C', 4, 'quarter')}
        ${note('D', 4, 'quarter')}
      </measure>`);
      const music = fromMusicXml(xml);
      expect(music.spanDecorations).toHaveLength(1);
      expect(music.spanDecorations[0].endNoteIndex).toBe(1);
    });
  });

  describe('beam continue without prior begin', () => {
    it('handles a beam:continue at the start of a measure without crashing', () => {
      // A 'continue' beam without a prior 'begin' should set beamStartIdx and not crash
      const xml = `<?xml version="1.0"?>
        <score-partwise version="3.1">
          <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
          <part id="P1">
            <measure number="1">
              <attributes>
                <divisions>4</divisions>
                <key><fifths>0</fifths></key>
                <time><beats>4</beats><beat-type>4</beat-type></time>
                <clef><sign>G</sign></clef>
              </attributes>
              <note>
                <pitch><step>C</step><octave>4</octave></pitch>
                <duration>2</duration>
                <type>eighth</type>
                <beam number="1">continue</beam>
              </note>
              <note>
                <pitch><step>D</step><octave>4</octave></pitch>
                <duration>2</duration>
                <type>eighth</type>
                <beam number="1">end</beam>
              </note>
            </measure>
          </part>
        </score-partwise>`;
      const music = fromMusicXml(xml);
      expect(music.notes).toHaveLength(2);
      // The beam should have been recorded (continue treated as begin, end closes it)
      expect(music.beams).toHaveLength(1);
      expect(music.beams[0]).toEqual([0, 1]);
    });
  });
});

describe('extractMxl', () => {
  function makeContainer(rootfilePath: string): Uint8Array {
    return new TextEncoder().encode(
      `<?xml version="1.0"?><container><rootfiles><rootfile full-path="${rootfilePath}"/></rootfiles></container>`
    );
  }

  function makeSimpleMusicXml(): Uint8Array {
    return new TextEncoder().encode(
      `<?xml version="1.0"?><score-partwise version="3.1"><part-list></part-list></score-partwise>`
    );
  }

  it('extracts XML from a valid .mxl buffer', () => {
    const musicXml = makeSimpleMusicXml();
    const buf = zipSync({
      'META-INF/container.xml': makeContainer('score.xml'),
      'score.xml': musicXml,
    }).buffer as ArrayBuffer;
    const xml = extractMxl(buf);
    expect(xml).toContain('score-partwise');
  });

  it('throws when META-INF/container.xml is missing', () => {
    const buf = zipSync({
      'score.xml': makeSimpleMusicXml(),
    }).buffer as ArrayBuffer;
    expect(() => extractMxl(buf)).toThrow('container.xml');
  });

  it('throws when container.xml has no rootfile element', () => {
    const emptyContainer = new TextEncoder().encode(
      `<?xml version="1.0"?><container><rootfiles></rootfiles></container>`
    );
    const buf = zipSync({
      'META-INF/container.xml': emptyContainer,
      'score.xml': makeSimpleMusicXml(),
    }).buffer as ArrayBuffer;
    expect(() => extractMxl(buf)).toThrow('rootfile');
  });

  it('throws when the rootfile path is not found in the zip', () => {
    const buf = zipSync({
      'META-INF/container.xml': makeContainer('missing.xml'),
      'score.xml': makeSimpleMusicXml(),
    }).buffer as ArrayBuffer;
    expect(() => extractMxl(buf)).toThrow('missing.xml');
  });
});
