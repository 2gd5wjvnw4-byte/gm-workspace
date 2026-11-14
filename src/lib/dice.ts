import type { RandomTableEntry } from './import/types';

export interface ParsedStandardDice {
  kind: 'standard';
  count: number;
  sides: number;
  modifier: number;
  raw: string;
}

export interface ParsedD66Dice {
  kind: 'd66';
  raw: string;
}

export type ParsedDice = ParsedStandardDice | ParsedD66Dice;

export interface ParsedRange {
  min: number;
  max: number;
}

export interface RollTableResult {
  roll: number;
  entry: RandomTableEntry | null;
  entryIndex: number;
}

/**
 * Parses a dice notation string:
 * - d66 / 1d66
 * - d100 / 1d100
 * - NdM, dM, NdM+K, NdM-K, dM+K, dM-K
 * Returns null if the expression cannot be parsed.
 */
export function parseDiceExpression(input: string): ParsedDice | null {
  const trimmed = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!trimmed) {
    return null;
  }

  if (trimmed === 'd66' || trimmed === '1d66') {
    return { kind: 'd66', raw: input.trim() };
  }

  const match = /^(\d*)d(\d+)([+-]\d+)?$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const count = match[1] ? Number.parseInt(match[1], 10) : 1;
  const sides = Number.parseInt(match[2], 10);
  const modifier = match[3] ? Number.parseInt(match[3], 10) : 0;

  if (!Number.isFinite(count) || count < 1 || count > 100) {
    return null;
  }
  if (!Number.isFinite(sides) || sides < 2 || sides > 1000) {
    return null;
  }
  if (!Number.isFinite(modifier)) {
    return null;
  }

  return {
    kind: 'standard',
    count,
    sides,
    modifier,
    raw: input.trim(),
  };
}

function parseRangeBound(token: string, isHighBound: boolean): number | null {
  const cleaned = token.trim();
  if (!/^\d+$/.test(cleaned)) {
    return null;
  }
  if (cleaned === '00' && (isHighBound || cleaned.length === 2)) {
    return 100;
  }
  const value = Number.parseInt(cleaned, 10);
  if (!Number.isFinite(value)) {
    return null;
  }
  return value;
}

/**
 * Parses a random table entry range like "1", "1-2", "01-05", "96-00", "00" (= 100), "66".
 * Returns null if unparseable.
 */
export function parseTableRange(rangeStr: string): ParsedRange | null {
  const trimmed = rangeStr.trim();
  if (!trimmed) {
    return null;
  }

  // Normalize en-dash / em-dash to hyphen
  const normalized = trimmed.replace(/[–—]/g, '-');
  if (!normalized.includes('-')) {
    const single = parseRangeBound(normalized, true);
    if (single === null) {
      return null;
    }
    return { min: single, max: single };
  }

  const parts = normalized.split('-');
  if (parts.length !== 2) {
    return null;
  }
  const min = parseRangeBound(parts[0], false);
  const max = parseRangeBound(parts[1], true);
  if (min === null || max === null || min > max) {
    return null;
  }
  return { min, max };
}

/**
 * Checks whether a table's dice expression and all entry ranges are valid and rollable.
 */
export function parseRollableTable(
  dice: string,
  entries: RandomTableEntry[]
): { parsedDice: ParsedDice; ranges: ParsedRange[] } | null {
  if (entries.length === 0) {
    return null;
  }
  const parsedDice = parseDiceExpression(dice);
  if (!parsedDice) {
    return null;
  }
  const ranges: ParsedRange[] = [];
  for (const entry of entries) {
    const range = parseTableRange(entry.range);
    if (!range) {
      return null;
    }
    ranges.push(range);
  }
  return { parsedDice, ranges };
}

function rollDie(sides: number, rng: () => number): number {
  const raw = Math.floor(rng() * sides) + 1;
  return Math.max(1, Math.min(sides, raw));
}

export function rollParsedDice(parsed: ParsedDice, rng: () => number = Math.random): number {
  if (parsed.kind === 'd66') {
    const tens = rollDie(6, rng);
    const ones = rollDie(6, rng);
    return tens * 10 + ones;
  }

  let total = 0;
  for (let i = 0; i < parsed.count; i += 1) {
    total += rollDie(parsed.sides, rng);
  }
  return total + parsed.modifier;
}

export function matchRollToEntry(
  roll: number,
  entries: RandomTableEntry[],
  ranges: ParsedRange[]
): { entry: RandomTableEntry | null; entryIndex: number } {
  for (let i = 0; i < entries.length; i += 1) {
    const range = ranges[i];
    if (range && roll >= range.min && roll <= range.max) {
      return { entry: entries[i], entryIndex: i };
    }
  }
  return { entry: null, entryIndex: -1 };
}

export function rollOnTable(
  dice: string,
  entries: RandomTableEntry[],
  rng: () => number = Math.random
): RollTableResult | null {
  const parsed = parseRollableTable(dice, entries);
  if (!parsed) {
    return null;
  }
  const roll = rollParsedDice(parsed.parsedDice, rng);
  const { entry, entryIndex } = matchRollToEntry(roll, entries, parsed.ranges);
  return { roll, entry, entryIndex };
}
