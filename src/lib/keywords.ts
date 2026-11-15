export interface KeywordTarget {
  kind: 'entity' | 'truth';
  id: string;
  label: string;
  terms: string[];
}

export type TextSegment =
  | { type: 'text'; text: string }
  | { type: 'keyword'; text: string; kind: 'entity' | 'truth'; targetId: string };

const GENERIC_ENTITY_WORDS = new Set([
  'chief',
  'station',
  'maintenance',
  'drones',
  'drone',
  'creature',
  'thing',
  'guard',
  'guards',
  'officer',
  'captain',
  'doctor',
  'corporal',
  'sergeant',
  'private',
  'technician',
  'specialist',
  'leader',
  'member',
  'trooper',
  'soldier',
  'patrol',
  'security',
  'system',
  'hidden',
]);

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildKeywordTargets(
  entities: Array<{ id: string; name: string }>,
  truths: Array<{ id: string; title: string }>
): KeywordTarget[] {
  const targets: KeywordTarget[] = [];

  // Count token frequency across entities so secondary single-word aliases are unambiguous
  const wordCounts = new Map<string, number>();
  for (const ent of entities) {
    const words = ent.name
      .trim()
      .split(/\s+/)
      .map((w) => w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ''))
      .filter((w) => w.length >= 5 && !GENERIC_ENTITY_WORDS.has(w.toLowerCase()));
    const uniqueInEntity = new Set(words.map((w) => w.toLowerCase()));
    for (const lower of uniqueInEntity) {
      wordCounts.set(lower, (wordCounts.get(lower) ?? 0) + 1);
    }
  }

  for (const ent of entities) {
    const fullName = ent.name.trim();
    if (fullName.length < 3) continue;
    const terms: string[] = [fullName];
    const parts = fullName
      .split(/\s+/)
      .map((w) => w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ''))
      .filter((w) => w.length >= 5 && !GENERIC_ENTITY_WORDS.has(w.toLowerCase()));
    for (const part of parts) {
      if (
        part.toLowerCase() !== fullName.toLowerCase() &&
        wordCounts.get(part.toLowerCase()) === 1 &&
        !terms.some((t) => t.toLowerCase() === part.toLowerCase())
      ) {
        terms.push(part);
      }
    }
    targets.push({
      kind: 'entity',
      id: ent.id,
      label: fullName,
      terms,
    });
  }

  for (const truth of truths) {
    const fullTitle = truth.title.trim();
    if (fullTitle.length < 3) continue;
    const terms: string[] = [fullTitle];
    const stripped = fullTitle.replace(/[?.!]+$/, '').trim();
    if (stripped.length >= 4 && stripped.toLowerCase() !== fullTitle.toLowerCase()) {
      terms.push(stripped);
    }
    targets.push({
      kind: 'truth',
      id: truth.id,
      label: fullTitle,
      terms,
    });
  }

  return targets;
}

export function segmentTextByKeywords(
  text: string,
  targets: KeywordTarget[]
): TextSegment[] {
  if (!text) return [];

  interface TermEntry {
    term: string;
    lower: string;
    kind: 'entity' | 'truth';
    targetId: string;
  }

  const entries: TermEntry[] = [];
  const seenLower = new Set<string>();

  for (const target of targets) {
    for (const rawTerm of target.terms) {
      const term = rawTerm.trim();
      if (term.length < 3) continue;
      const lower = term.toLowerCase();
      if (seenLower.has(lower)) continue;
      seenLower.add(lower);
      entries.push({
        term,
        lower,
        kind: target.kind,
        targetId: target.id,
      });
    }
  }

  if (entries.length === 0) {
    return [{ type: 'text', text }];
  }

  // Longest match first so "Chief Dana Okafor" wins over "Okafor"
  entries.sort((a, b) => b.term.length - a.term.length);

  const byLower = new Map<string, TermEntry>();
  for (const entry of entries) {
    byLower.set(entry.lower, entry);
  }

  const alternation = entries.map((e) => escapeRegExp(e.term)).join('|');
  const pattern = new RegExp(`(?<![A-Za-z0-9_])(${alternation})(?![A-Za-z0-9_])`, 'gi');

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const matchIndex = match.index ?? 0;
    const matchedText = match[0];
    const entry = byLower.get(matchedText.toLowerCase());
    if (!entry) continue;

    if (matchIndex > lastIndex) {
      segments.push({
        type: 'text',
        text: text.slice(lastIndex, matchIndex),
      });
    }

    segments.push({
      type: 'keyword',
      text: matchedText,
      kind: entry.kind,
      targetId: entry.targetId,
    });

    lastIndex = matchIndex + matchedText.length;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      text: text.slice(lastIndex),
    });
  }

  return segments.length > 0 ? segments : [{ type: 'text', text }];
}
