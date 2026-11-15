import { describe, expect, it } from 'vitest';
import { buildKeywordTargets, segmentTextByKeywords } from './keywords';

describe('keywords helper', () => {
  const sampleEntities = [
    { id: 'e-okafor', name: 'Chief Dana Okafor' },
    { id: 'e-drones', name: 'Maintenance Drones' },
    { id: 'e-creature', name: 'The Vent Thing' },
    { id: 'e-art', name: 'Art' },
  ];

  const sampleTruths = [
    { id: 't-sabotage', title: 'Who caused the reactor failure?' },
    { id: 't-signal', title: 'What is the signal?' },
  ];

  it('builds keyword targets with full entity names, unique surname aliases, and truth titles', () => {
    const targets = buildKeywordTargets(sampleEntities, sampleTruths);
    const okafor = targets.find((t) => t.id === 'e-okafor');
    expect(okafor).toBeDefined();
    expect(okafor?.terms).toContain('Chief Dana Okafor');
    expect(okafor?.terms).toContain('Okafor');

    const signal = targets.find((t) => t.id === 't-signal');
    expect(signal?.terms).toContain('What is the signal?');
    expect(signal?.terms).toContain('What is the signal');
  });

  it('matches entity names and distinctive aliases case-insensitively on whole-word boundaries', () => {
    const targets = buildKeywordTargets(sampleEntities, sampleTruths);
    const segments = segmentTextByKeywords(
      'Shows 14 staff. Station Chief Okafor was on duty while maintenance drones patrolled.',
      targets
    );

    const keywordMatches = segments.filter((s) => s.type === 'keyword');
    expect(keywordMatches).toEqual([
      {
        type: 'keyword',
        text: 'Okafor',
        kind: 'entity',
        targetId: 'e-okafor',
      },
      {
        type: 'keyword',
        text: 'maintenance drones',
        kind: 'entity',
        targetId: 'e-drones',
      },
    ]);
  });

  it('prefers longest match first and never matches partial words inside larger words', () => {
    const targets = buildKeywordTargets(sampleEntities, sampleTruths);
    const segments = segmentTextByKeywords(
      'Starting early, Chief Dana Okafor inspected the chart and department.',
      targets
    );

    const keywordMatches = segments.filter((s) => s.type === 'keyword');
    // "Art" must NOT match inside "Starting", "chart", or "department"
    // "Chief Dana Okafor" must match as one full phrase instead of just "Okafor"
    expect(keywordMatches).toEqual([
      {
        type: 'keyword',
        text: 'Chief Dana Okafor',
        kind: 'entity',
        targetId: 'e-okafor',
      },
    ]);
  });

  it('matches truth titles with or without trailing punctuation', () => {
    const targets = buildKeywordTargets(sampleEntities, sampleTruths);
    const segments = segmentTextByKeywords(
      'Ask yourself: What is the signal? And who caused the reactor failure in Ops.',
      targets
    );

    const keywordMatches = segments.filter((s) => s.type === 'keyword');
    expect(keywordMatches).toEqual([
      {
        type: 'keyword',
        text: 'What is the signal?',
        kind: 'truth',
        targetId: 't-signal',
      },
      {
        type: 'keyword',
        text: 'who caused the reactor failure',
        kind: 'truth',
        targetId: 't-sabotage',
      },
    ]);
  });
});
