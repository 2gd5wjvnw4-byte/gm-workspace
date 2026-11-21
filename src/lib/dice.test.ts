import { describe, expect, it } from 'vitest';
import {
  computeTotalFromDiceBoxResults,
  parseDiceExpression,
  parseRollableTable,
  parseTableRange,
  rollOnTable,
  rollParsedDice,
  toDiceBoxPlan,
} from './dice';
import type { RandomTableEntry } from './import/types';

function seqRng(values: number[]): () => number {
  let idx = 0;
  return () => {
    const v = values[idx % values.length];
    idx += 1;
    return v;
  };
}

describe('parseDiceExpression', () => {
  it('parses standard NdM, dM, and +/- modifiers across d4-d100', () => {
    for (const sides of [4, 6, 8, 10, 12, 20, 100]) {
      expect(parseDiceExpression(`d${sides}`)).toEqual({
        kind: 'standard',
        count: 1,
        sides,
        modifier: 0,
        raw: `d${sides}`,
      });
    }
    expect(parseDiceExpression('1d6')).toEqual({
      kind: 'standard',
      count: 1,
      sides: 6,
      modifier: 0,
      raw: '1d6',
    });
    expect(parseDiceExpression('2d6+3')).toEqual({
      kind: 'standard',
      count: 2,
      sides: 6,
      modifier: 3,
      raw: '2d6+3',
    });
    expect(parseDiceExpression('1d10 - 2')).toEqual({
      kind: 'standard',
      count: 1,
      sides: 10,
      modifier: -2,
      raw: '1d10 - 2',
    });
  });

  it('parses d100, 1d100, and d66', () => {
    expect(parseDiceExpression('d100')).toEqual({
      kind: 'standard',
      count: 1,
      sides: 100,
      modifier: 0,
      raw: 'd100',
    });
    expect(parseDiceExpression('1d100')).toEqual({
      kind: 'standard',
      count: 1,
      sides: 100,
      modifier: 0,
      raw: '1d100',
    });
    expect(parseDiceExpression('d66')).toEqual({
      kind: 'd66',
      raw: 'd66',
    });
    expect(parseDiceExpression('1d66')).toEqual({
      kind: 'd66',
      raw: '1d66',
    });
  });

  it('parses compound dice notation with multiple terms and modifiers', () => {
    expect(parseDiceExpression('2d6+1d8+2')).toEqual({
      kind: 'compound',
      terms: [
        { sign: 1, count: 2, sides: 6 },
        { sign: 1, count: 1, sides: 8 },
      ],
      modifier: 2,
      raw: '2d6+1d8+2',
    });

    expect(parseDiceExpression('1d20 + 1d4 - 1')).toEqual({
      kind: 'compound',
      terms: [
        { sign: 1, count: 1, sides: 20 },
        { sign: 1, count: 1, sides: 4 },
      ],
      modifier: -1,
      raw: '1d20 + 1d4 - 1',
    });

    expect(parseDiceExpression('2d6 - 1d4 + 3')).toEqual({
      kind: 'compound',
      terms: [
        { sign: 1, count: 2, sides: 6 },
        { sign: -1, count: 1, sides: 4 },
      ],
      modifier: 3,
      raw: '2d6 - 1d4 + 3',
    });
  });

  it('returns null for unparseable dice strings', () => {
    expect(parseDiceExpression('')).toBeNull();
    expect(parseDiceExpression('2d')).toBeNull();
    expect(parseDiceExpression('0d6')).toBeNull();
    expect(parseDiceExpression('1d1')).toBeNull();
    expect(parseDiceExpression('draw a card')).toBeNull();
    expect(parseDiceExpression('2d6+')).toBeNull();
    expect(parseDiceExpression('1d6++1d4')).toBeNull();
    expect(parseDiceExpression('5+3')).toBeNull();
  });
});

describe('toDiceBoxPlan and computeTotalFromDiceBoxResults', () => {
  it('maps compound notation to dice-box array format plus modifier math', () => {
    const parsed = parseDiceExpression('2d6+1d8+2')!;
    expect(toDiceBoxPlan(parsed)).toEqual({
      notation: ['2d6', '1d8'],
      modifier: 2,
      kind: 'compound',
      supported3d: true,
      termSigns: [1, 1],
    });

    const settled = computeTotalFromDiceBoxResults(parsed, [
      { value: 7, rolls: [{ value: 3 }, { value: 4 }] },
      { value: 6, rolls: [{ value: 6 }] },
    ]);
    expect(settled).toEqual({
      total: 15,
      diceValues: [3, 4, 6],
    });
  });

  it('maps d66 to 2d6 tens/ones and computes settled d66 total', () => {
    const parsed = parseDiceExpression('d66')!;
    expect(toDiceBoxPlan(parsed)).toEqual({
      notation: ['2d6'],
      modifier: 0,
      kind: 'd66',
      supported3d: true,
      termSigns: [1],
    });

    const settled = computeTotalFromDiceBoxResults(parsed, [
      { value: 9, rolls: [{ value: 4 }, { value: 5 }] },
    ]);
    expect(settled).toEqual({
      total: 45,
      diceValues: [4, 5],
    });
  });

  it('marks non-standard die sides as unsupported for 3D meshes', () => {
    const d3 = parseDiceExpression('1d3')!;
    expect(toDiceBoxPlan(d3).supported3d).toBe(false);

    const compoundUnsupported = parseDiceExpression('1d6+1d14')!;
    expect(toDiceBoxPlan(compoundUnsupported).supported3d).toBe(false);
  });

  it('handles d100 0 -> 100 edge case and modifier on standard rolls', () => {
    const d100 = parseDiceExpression('1d100')!;
    expect(computeTotalFromDiceBoxResults(d100, [{ value: 0, rolls: [{ value: 0 }] }])).toEqual({
      total: 100,
      diceValues: [0],
    });

    const mod = parseDiceExpression('2d6+3')!;
    expect(
      computeTotalFromDiceBoxResults(mod, [{ value: 8, rolls: [{ value: 3 }, { value: 5 }] }])
    ).toEqual({
      total: 11,
      diceValues: [3, 5],
    });
  });
});

describe('parseTableRange', () => {
  it('parses single values, hyphen ranges, zero-padded ranges, and 00 as 100', () => {
    expect(parseTableRange('1')).toEqual({ min: 1, max: 1 });
    expect(parseTableRange('1-2')).toEqual({ min: 1, max: 2 });
    expect(parseTableRange('01-05')).toEqual({ min: 1, max: 5 });
    expect(parseTableRange('00')).toEqual({ min: 100, max: 100 });
    expect(parseTableRange('96-00')).toEqual({ min: 96, max: 100 });
    expect(parseTableRange('66')).toEqual({ min: 66, max: 66 });
    expect(parseTableRange('11–16')).toEqual({ min: 11, max: 16 });
  });

  it('returns null for invalid ranges', () => {
    expect(parseTableRange('')).toBeNull();
    expect(parseTableRange('abc')).toBeNull();
    expect(parseTableRange('5-2')).toBeNull();
    expect(parseTableRange('1-2-3')).toBeNull();
  });
});

describe('rollParsedDice and rollOnTable', () => {
  it('rolls NdM+K, NdM-K, and compound notation deterministically', () => {
    const plus = parseDiceExpression('2d6+2')!;
    // 0.0 -> 1, 0.99 -> 6 => 1 + 6 + 2 = 9
    expect(rollParsedDice(plus, seqRng([0.0, 0.99]))).toBe(9);

    const minus = parseDiceExpression('1d8-1')!;
    // 0.5 -> floor(0.5*8)+1 = 5 => 5 - 1 = 4
    expect(rollParsedDice(minus, seqRng([0.5]))).toBe(4);

    const compound = parseDiceExpression('2d6+1d8+2')!;
    // 0.0 -> 1, 0.5 -> 4 (d6), 0.5 -> 5 (d8) => 1 + 4 + 5 + 2 = 12
    expect(rollParsedDice(compound, seqRng([0.0, 0.5, 0.5]))).toBe(12);
  });

  it('rolls d66 as tens and ones', () => {
    const d66 = parseDiceExpression('d66')!;
    // 0.0 -> 1, 0.99 -> 6 => 16
    expect(rollParsedDice(d66, seqRng([0.0, 0.99]))).toBe(16);
    // 0.99 -> 6, 0.99 -> 6 => 66
    expect(rollParsedDice(d66, seqRng([0.99, 0.99]))).toBe(66);
  });

  it('rolls d100 and matches 01-05 and 00 (= 100)', () => {
    const entries: RandomTableEntry[] = [
      { range: '01-05', text: 'Early omen', entity_id: null },
      { range: '06-99', text: 'Middle', entity_id: null },
      { range: '00', text: 'Catastrophe', entity_id: 'e-cat' },
    ];
    const low = rollOnTable('d100', entries, seqRng([0.0])); // roll 1
    expect(low?.roll).toBe(1);
    expect(low?.entry?.text).toBe('Early omen');

    const hundred = rollOnTable('1d100', entries, seqRng([0.999])); // roll 100
    expect(hundred?.roll).toBe(100);
    expect(hundred?.entry?.text).toBe('Catastrophe');
    expect(hundred?.entry?.entity_id).toBe('e-cat');
  });

  it('matches Relay Encounters style 1d6 table', () => {
    const entries: RandomTableEntry[] = [
      { range: '1-2', text: 'Flickering lights and distant metal groan.', entity_id: null },
      { range: '3-4', text: 'Two maintenance drones sweep the hall.', entity_id: 'e-drones' },
      { range: '5', text: 'Cold mist vents from a broken pipe.', entity_id: null },
      { range: '6', text: 'The creature stalks from the dark.', entity_id: 'e-creature' },
    ];
    expect(rollOnTable('1d6', entries, seqRng([0.0]))?.entry?.text).toBe(
      'Flickering lights and distant metal groan.'
    );
    expect(rollOnTable('1d6', entries, seqRng([0.5]))?.entry?.entity_id).toBe('e-drones');
    expect(rollOnTable('1d6', entries, seqRng([0.99]))?.entry?.entity_id).toBe('e-creature');
  });

  it('returns null from parseRollableTable when dice or any range is unparseable', () => {
    const badDice: RandomTableEntry[] = [{ range: '1-2', text: 'Ok', entity_id: null }];
    expect(parseRollableTable('special', badDice)).toBeNull();
    expect(rollOnTable('special', badDice)).toBeNull();

    const badRange: RandomTableEntry[] = [
      { range: '1-2', text: 'Ok', entity_id: null },
      { range: 'else', text: 'Bad', entity_id: null },
    ];
    expect(parseRollableTable('1d6', badRange)).toBeNull();
    expect(rollOnTable('1d6', badRange)).toBeNull();
  });
});
