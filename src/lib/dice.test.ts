import { describe, expect, it } from 'vitest';
import {
  parseDiceExpression,
  parseRollableTable,
  parseTableRange,
  rollOnTable,
  rollParsedDice,
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
  it('parses standard NdM, dM, and +/- modifiers', () => {
    expect(parseDiceExpression('1d6')).toEqual({
      kind: 'standard',
      count: 1,
      sides: 6,
      modifier: 0,
      raw: '1d6',
    });
    expect(parseDiceExpression('d20')).toEqual({
      kind: 'standard',
      count: 1,
      sides: 20,
      modifier: 0,
      raw: 'd20',
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

  it('returns null for unparseable dice strings', () => {
    expect(parseDiceExpression('')).toBeNull();
    expect(parseDiceExpression('2d')).toBeNull();
    expect(parseDiceExpression('0d6')).toBeNull();
    expect(parseDiceExpression('1d1')).toBeNull();
    expect(parseDiceExpression('draw a card')).toBeNull();
    expect(parseDiceExpression('1d6+1d4')).toBeNull();
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
  it('rolls NdM+K and NdM-K deterministically', () => {
    const plus = parseDiceExpression('2d6+2')!;
    // 0.0 -> 1, 0.99 -> 6 => 1 + 6 + 2 = 9
    expect(rollParsedDice(plus, seqRng([0.0, 0.99]))).toBe(9);

    const minus = parseDiceExpression('1d8-1')!;
    // 0.5 -> floor(0.5*8)+1 = 5 => 5 - 1 = 4
    expect(rollParsedDice(minus, seqRng([0.5]))).toBe(4);
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
    // 0.0 -> roll 1
    expect(rollOnTable('1d6', entries, seqRng([0.0]))?.entry?.text).toBe(
      'Flickering lights and distant metal groan.'
    );
    // 0.5 -> roll 4
    expect(rollOnTable('1d6', entries, seqRng([0.5]))?.entry?.entity_id).toBe('e-drones');
    // 0.99 -> roll 6
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
