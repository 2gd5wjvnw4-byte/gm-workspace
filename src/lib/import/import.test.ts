import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatCarryOverIds,
  mergeParsedChunks,
  parseModuleChunk,
  reconcileLiveNotes,
  upsertParsedChunk,
} from './index';
import { createDefaultLiveState } from '../../storage/types';

const samplePath = resolve(process.cwd(), 'samples/silent-relay-a1.json');
const sampleRawText = readFileSync(samplePath, 'utf-8');

describe('Module Import System (parser, linkChecker, merge, carryOver)', () => {
  it('imports samples/silent-relay-a1.json with zero warnings and marks unloaded act links as not_loaded', () => {
    const parsed = parseModuleChunk(sampleRawText);
    const merged = mergeParsedChunks([parsed]);

    const warnEntries = merged.review.filter((r) => r.severity === 'warn');
    expect(warnEntries).toEqual([]);

    // Scene a1-s02 has needs_review: true -> logged as info
    const infoEntries = merged.review.filter((r) => r.severity === 'info');
    expect(infoEntries).toHaveLength(1);
    expect(infoEntries[0].recordId).toBe('a1-s02');
    expect(infoEntries[0].field).toBe('needs_review');

    // Connection a1-x04 points to a2-s01 (act a2 is not loaded) -> marked not_loaded, no warning
    expect(merged.linkCheck.notLoadedTargets.has('a2-s01')).toBe(true);
    expect(merged.linkCheck.brokenTargets.size).toBe(0);
    expect(merged.scenes).toHaveLength(4);
    expect(merged.entities).toHaveLength(3);
  });

  it('imports a broken copy of the sample without throwing and produces expected Review entries', () => {
    const brokenObj = JSON.parse(sampleRawText) as Record<string, unknown>;
    brokenObj.trailing_garbage_root = { extra: 'keep me in rawJson' };

    const scenes = brokenObj.scenes as Array<Record<string, unknown>>;
    // 1. Unknown archetype & missing title on first scene + trailing garbage field
    delete scenes[0].title;
    scenes[0].archetype = 'cyber_dungeon_unknown';
    scenes[0].extra_scene_garbage = 999;

    // 2. Duplicate ID inside the chunk (second scene gets same id as first scene)
    scenes[1].id = 'a1-s01';

    // 3. Bad links: unknown entity_id, unknown truth_id, unlocking an already-open connection
    scenes[2].entity_ids = ['e-nonexistent'];
    const s2Items = scenes[2].tier2_interactive as Array<Record<string, unknown>>;
    s2Items[0].truth_id = 't-nonexistent';
    s2Items[0].unlocks_connection_id = 'a1-x02'; // a1-x02 has state "open"

    // 4. Isolated scene with no connection in or out
    scenes.push({
      id: 'a1-s99',
      code: '99',
      title: 'Isolated Chamber',
      act_id: 'a1',
      archetype: 'physical_zone',
      group: 'Outer',
      page: 21,
      summary: 'No way in or out',
      tags: [],
      read_aloud: null,
      tier1_sensory: [],
      tier2_interactive: [],
      tier3_hidden: [],
      entity_ids: [],
      gm_tips: '',
      escalation: [],
      default_map_id: null,
    });

    // 5. Core truth with fewer than 2 clues (t-sabotage lost s2Items[0] clue above, leaving only 1 clue on e-okafor)
    const parsed = parseModuleChunk(JSON.stringify(brokenObj));
    const merged = mergeParsedChunks([parsed]);

    // Preserves trailing garbage fields in rawJson
    expect(parsed.chunk.rawJson.trailing_garbage_root).toEqual({
      extra: 'keep me in rawJson',
    });

    // Renamed duplicate ID to a1-s01-2
    expect(merged.scenes.map((s) => s.id)).toContain('a1-s01-2');
    expect(
      merged.review.some(
        (r) =>
          r.recordId === 'a1-s01-2' &&
          r.field === 'id' &&
          r.message.includes('Duplicate ID')
      )
    ).toBe(true);

    // Missing title warning
    expect(
      merged.review.some((r) => r.recordId === 'a1-s01' && r.field === 'title')
    ).toBe(true);

    // Unknown archetype warning + fallback to 'unknown'
    expect(merged.scenes[0].archetype).toBe('unknown');
    expect(
      merged.review.some((r) => r.recordId === 'a1-s01' && r.field === 'archetype')
    ).toBe(true);

    // Broken links flagged
    expect(merged.linkCheck.brokenTargets.has('e-nonexistent')).toBe(true);
    expect(merged.linkCheck.brokenTargets.has('t-nonexistent')).toBe(true);

    // Unlocking an already-open connection warning
    expect(
      merged.review.some(
        (r) =>
          r.recordId === 'a1-s03-i1' &&
          r.field === 'unlocks_connection_id' &&
          r.message.includes('open')
      )
    ).toBe(true);

    // Core truth with < 2 clues warning
    expect(merged.linkCheck.underCluedTruthIds.has('t-sabotage')).toBe(true);
    expect(
      merged.review.some((r) => r.recordId === 't-sabotage' && r.field === 'clues')
    ).toBe(true);

    // Scene with no connection in or out warning
    expect(
      merged.review.some((r) => r.recordId === 'a1-s99' && r.field === 'connections')
    ).toBe(true);
  });

  it('throws an Error only when input text is not valid JSON', () => {
    expect(() => parseModuleChunk('{ bad json ')).toThrow(/Invalid JSON/);
    expect(() => parseModuleChunk('')).toThrow(/Invalid JSON/);

    // Valid JSON but empty object does not throw
    const emptyRes = parseModuleChunk('{}');
    expect(emptyRes.chunk.meta.module_id).toBe('mod-unknown');
    expect(emptyRes.review.length).toBeGreaterThan(0);
  });

  it('re-importing the same chunk_id replaces that chunk, while later chunk ids win on record merge and log info', () => {
    const first = parseModuleChunk(sampleRawText);

    // Modified version of the same chunk_id (chunk-a1)
    const modifiedA1Obj = JSON.parse(sampleRawText) as Record<string, unknown>;
    (modifiedA1Obj.meta as Record<string, unknown>).chunk_title = 'Act 1 Revised';
    const reimportedA1 = parseModuleChunk(JSON.stringify(modifiedA1Obj));

    const afterReimport = upsertParsedChunk([first], reimportedA1);
    expect(afterReimport).toHaveLength(1);
    const mergedReimport = mergeParsedChunks(afterReimport);
    expect(mergedReimport.chunks[0].meta.chunk_title).toBe('Act 1 Revised');

    // Second chunk (chunk-a2) that overrides entity e-okafor
    const chunkA2Obj = {
      schema_version: '1.0',
      meta: {
        module_id: 'mod-silent-relay',
        title: 'The Silent Relay',
        system: 'Mothership 1e',
        genre: 'sci-fi horror',
        check_format: 'd100',
        page_offset: 2,
        chunk_id: 'chunk-a2',
        chunk_title: 'Act 2: Planetfall',
        chunk_pages: '23-40',
        complete: true,
        stopped_at_page: null,
      },
      trackers: [],
      acts: [
        {
          id: 'a2',
          title: 'Planetfall',
          page_start: 23,
          page_end: 40,
          summary: 'On the surface.',
        },
      ],
      scenes: [
        {
          id: 'a2-s01',
          code: '2.1',
          title: 'Landing Zone',
          act_id: 'a2',
          archetype: 'physical_zone',
          group: 'Surface',
          page: 24,
          summary: 'Crater landing zone.',
          tags: [],
          read_aloud: null,
          tier1_sensory: [],
          tier2_interactive: [],
          tier3_hidden: [],
          entity_ids: ['e-okafor'],
          gm_tips: '',
          escalation: [],
          default_map_id: null,
        },
      ],
      connections: [],
      entities: [
        {
          ...(JSON.parse(sampleRawText).entities[0] as Record<string, unknown>),
          summary: 'Okafor on the surface, now allied.',
          disposition: 'allied',
        },
      ],
      truths: [],
      clocks: [],
      timeline: [],
      factions: [],
      random_tables: [],
    };

    const parsedA2 = parseModuleChunk(JSON.stringify(chunkA2Obj));
    const mergedBoth = mergeParsedChunks([reimportedA1, parsedA2]);

    const okafor = mergedBoth.entities.find((e) => e.id === 'e-okafor');
    expect(okafor?.summary).toBe('Okafor on the surface, now allied.');
    expect(
      mergedBoth.review.some(
        (r) =>
          r.severity === 'info' &&
          r.chunkId === 'chunk-a2' &&
          r.recordId === 'e-okafor'
      )
    ).toBe(true);

    // Now that a2-s01 is loaded, it is no longer in notLoadedTargets
    expect(mergedBoth.linkCheck.notLoadedTargets.has('a2-s01')).toBe(false);
  });

  it('moves live notes whose target ID no longer exists into looseNotes without touching other live state', () => {
    const parsed = parseModuleChunk(sampleRawText);
    const merged = mergeParsedChunks([parsed]);

    const live = createDefaultLiveState('camp-1', 'scifi');
    live.visited = { 'a1-s01': true };
    live.notes = [
      { id: 'n1', targetId: 'a1-s01', text: 'Airlock forced', createdAt: 100 },
      { id: 'n2', targetId: 'a1-s99-removed', text: 'Old room note', createdAt: 200 },
    ];

    const reconciled = reconcileLiveNotes(live, merged);
    expect(reconciled.visited).toEqual({ 'a1-s01': true });
    expect(reconciled.notes).toHaveLength(1);
    expect(reconciled.notes[0].id).toBe('n1');
    expect(reconciled.looseNotes).toHaveLength(1);
    expect(reconciled.looseNotes[0].id).toBe('n2');
  });

  it('formats the plain-text carry-over IDs list with entities, truths, factions, clocks, tables, and trackers', () => {
    const parsed = parseModuleChunk(sampleRawText);
    const merged = mergeParsedChunks([parsed]);
    const output = formatCarryOverIds(merged);

    expect(output).toContain('# Carry-over IDs — The Silent Relay (mod-silent-relay)');
    expect(output).toContain('- e-okafor: Chief Dana Okafor');
    expect(output).toContain('- e-creature: The Vent Thing');
    expect(output).toContain('- e-drones: Maintenance Drones');
    expect(output).toContain('- t-sabotage: Who caused the reactor failure?');
    expect(output).toContain('- t-signal: What is the signal?');
    expect(output).toContain('- f-helix: Helix Dynamics');
    expect(output).toContain('- k-reactor: Reactor Meltdown');
    expect(output).toContain('- rt-relay: Relay Encounters');
    expect(output).toContain('- tr-stress: Crew Stress');
    expect(output).toContain('- tr-o2: O2 (hours)');
    expect(output).toContain('- tr-day: Day');
  });
});
