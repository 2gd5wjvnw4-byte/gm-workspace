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

export interface ParsedDiceTerm {
  sign: 1 | -1;
  count: number;
  sides: number;
}

export interface ParsedCompoundDice {
  kind: 'compound';
  terms: ParsedDiceTerm[];
  modifier: number;
  raw: string;
}

export type ParsedDice = ParsedStandardDice | ParsedD66Dice | ParsedCompoundDice;

export interface ParsedRange {
  min: number;
  max: number;
}

export interface RollTableResult {
  roll: number;
  entry: RandomTableEntry | null;
  entryIndex: number;
}

export interface DiceBoxRollPlan {
  notation: string[];
  modifier: number;
  kind: 'standard' | 'd66' | 'compound';
  supported3d: boolean;
  termSigns: Array<1 | -1>;
}

export interface DiceBoxGroupInput {
  value: number;
  rolls?: ReadonlyArray<{ value: number }>;
}

export interface ComputedDiceRoll {
  total: number;
  diceValues: number[];
}

export const SUPPORTED_3D_SIDES: ReadonlySet<number> = new Set([4, 6, 8, 10, 12, 20, 100]);

/**
 * Parses a dice notation string:
 * - d66 / 1d66
 * - d100 / 1d100
 * - NdM, dM, NdM+K, NdM-K, dM+K, dM-K
 * - Compound notation such as 2d6+1d8+2 or 1d20+1d4-1
 * Returns null if the expression cannot be parsed.
 */
export function parseDiceExpression(input: string): ParsedDice | null {
  const raw = input.trim();
  const trimmed = raw.toLowerCase().replace(/\s+/g, '');
  if (!trimmed) {
    return null;
  }

  if (trimmed === 'd66' || trimmed === '1d66') {
    return { kind: 'd66', raw };
  }

  const singleMatch = /^(\d*)d(\d+)([+-]\d+)?$/.exec(trimmed);
  if (singleMatch) {
    const count = singleMatch[1] ? Number.parseInt(singleMatch[1], 10) : 1;
    const sides = Number.parseInt(singleMatch[2], 10);
    const modifier = singleMatch[3] ? Number.parseInt(singleMatch[3], 10) : 0;

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
      raw,
    };
  }

  // Compound expression: e.g. 2d6+1d8+2, 1d20+1d4-1, d6+d8
  if (/^[+-]/.test(trimmed) || /[+-]$/.test(trimmed) || /[+-]{2,}/.test(trimmed)) {
    return null;
  }

  const tokens = trimmed.match(/[+-]?[^+-]+/g);
  if (!tokens || tokens.length < 2) {
    return null;
  }

  const terms: ParsedDiceTerm[] = [];
  let modifier = 0;
  let totalDiceCount = 0;

  for (const token of tokens) {
    const sign: 1 | -1 = token.startsWith('-') ? -1 : 1;
    const body = token.startsWith('+') || token.startsWith('-') ? token.slice(1) : token;
    if (!body) {
      return null;
    }

    const dieMatch = /^(\d*)d(\d+)$/.exec(body);
    if (dieMatch) {
      const count = dieMatch[1] ? Number.parseInt(dieMatch[1], 10) : 1;
      const sides = Number.parseInt(dieMatch[2], 10);
      if (!Number.isFinite(count) || count < 1 || count > 100) {
        return null;
      }
      if (!Number.isFinite(sides) || sides < 2 || sides > 1000) {
        return null;
      }
      totalDiceCount += count;
      if (totalDiceCount > 100) {
        return null;
      }
      terms.push({ sign, count, sides });
      continue;
    }

    if (/^\d+$/.test(body)) {
      const num = Number.parseInt(body, 10);
      if (!Number.isFinite(num)) {
        return null;
      }
      modifier += sign * num;
      continue;
    }

    return null;
  }

  if (terms.length === 0) {
    return null;
  }

  if (terms.length === 1 && terms[0].sign === 1) {
    return {
      kind: 'standard',
      count: terms[0].count,
      sides: terms[0].sides,
      modifier,
      raw,
    };
  }

  return {
    kind: 'compound',
    terms,
    modifier,
    raw,
  };
}

/**
 * Converts a parsed dice expression into the array format @3d-dice/dice-box accepts
 * plus modifier math and whether all dice have 3D meshes in the default theme.
 */
export function toDiceBoxPlan(parsed: ParsedDice): DiceBoxRollPlan {
  if (parsed.kind === 'd66') {
    return {
      notation: ['2d6'],
      modifier: 0,
      kind: 'd66',
      supported3d: true,
      termSigns: [1],
    };
  }

  if (parsed.kind === 'standard') {
    return {
      notation: [`${parsed.count}d${parsed.sides}`],
      modifier: parsed.modifier,
      kind: 'standard',
      supported3d: SUPPORTED_3D_SIDES.has(parsed.sides),
      termSigns: [1],
    };
  }

  return {
    notation: parsed.terms.map((t) => `${t.count}d${t.sides}`),
    modifier: parsed.modifier,
    kind: 'compound',
    supported3d: parsed.terms.every((t) => SUPPORTED_3D_SIDES.has(t.sides)),
    termSigns: parsed.terms.map((t) => t.sign),
  };
}

/**
 * Computes the final total and individual die values from @3d-dice/dice-box roll groups.
 * Returns null if the settled group shape does not match the parsed expression.
 */
export function computeTotalFromDiceBoxResults(
  parsed: ParsedDice,
  groups: ReadonlyArray<DiceBoxGroupInput>
): ComputedDiceRoll | null {
  if (!Array.isArray(groups) || groups.length === 0) {
    return null;
  }

  if (parsed.kind === 'd66') {
    const rolled: number[] = [];
    for (const g of groups) {
      if (Array.isArray(g.rolls)) {
        for (const r of g.rolls) {
          if (Number.isFinite(r.value)) {
            rolled.push(r.value);
          }
        }
      }
    }
    if (rolled.length < 2) {
      return null;
    }
    const tens = rolled[0];
    const ones = rolled[1];
    if (tens < 1 || tens > 6 || ones < 1 || ones > 6) {
      return null;
    }
    return {
      total: tens * 10 + ones,
      diceValues: [tens, ones],
    };
  }

  if (parsed.kind === 'standard') {
    const group = groups[0];
    if (!group || !Number.isFinite(group.value)) {
      return null;
    }
    const diceValues = group.rolls
      ? group.rolls.map((r: { value: number }) => r.value).filter((v: number) => Number.isFinite(v))
      : [group.value];
    let rawGroupTotal = group.value;
    // Normalize d100 00+0 = 0 edge case if a runtime ever emits 0 instead of 100
    if (parsed.sides === 100 && parsed.count === 1 && rawGroupTotal === 0) {
      rawGroupTotal = 100;
    }
    return {
      total: rawGroupTotal + parsed.modifier,
      diceValues,
    };
  }

  if (groups.length !== parsed.terms.length) {
    return null;
  }

  let total = parsed.modifier;
  const diceValues: number[] = [];
  for (let i = 0; i < parsed.terms.length; i += 1) {
    const term = parsed.terms[i];
    const group = groups[i];
    if (!group || !Number.isFinite(group.value)) {
      return null;
    }
    let groupVal = group.value;
    if (term.sides === 100 && term.count === 1 && groupVal === 0) {
      groupVal = 100;
    }
    total += term.sign * groupVal;
    if (Array.isArray(group.rolls)) {
      for (const r of group.rolls) {
        if (Number.isFinite(r.value)) {
          diceValues.push(r.value);
        }
      }
    } else {
      diceValues.push(groupVal);
    }
  }

  return { total, diceValues };
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

  if (parsed.kind === 'standard') {
    let total = 0;
    for (let i = 0; i < parsed.count; i += 1) {
      total += rollDie(parsed.sides, rng);
    }
    return total + parsed.modifier;
  }

  let total = parsed.modifier;
  for (const term of parsed.terms) {
    let termTotal = 0;
    for (let i = 0; i < term.count; i += 1) {
      termTotal += rollDie(term.sides, rng);
    }
    total += term.sign * termTotal;
  }
  return total;
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
