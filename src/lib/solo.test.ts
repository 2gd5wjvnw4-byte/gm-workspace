import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseModuleChunk } from './import';
import {
  buildUnlockingItemsByConnection,
  computeReachableSceneIds,
  getArchetypeLabels,
  getEffectiveConnectionState,
  getMaskedItemView,
  getSceneExits,
  getSceneVisibility,
  searchModuleRecords,
} from './solo';

const samplePath = resolve(process.cwd(), 'samples/silent-relay-a1.json');
const sampleRawText = readFileSync(samplePath, 'utf-8');
const { chunk: sampleChunk } = parseModuleChunk(sampleRawText);

describe('Solo Mask and scene reachability rules (src/lib/solo.ts)', () => {
  it('returns exact archetype labels for all 5 archetypes from PROJECT_BRIEF', () => {
    expect(getArchetypeLabels('physical_zone')).toEqual({
      name: 'Physical Zone',
      tier1: 'Sensory',
      tier2: 'Interactive',
      tier3: 'Hidden Threats & Loot',
      exits: 'Exits',
    });
    expect(getArchetypeLabels('open_hub')).toEqual({
      name: 'Open Hub',
      tier1: 'Atmosphere',
      tier2: 'Points of Interest & Hooks',
      tier3: 'Secrets',
      exits: 'Go To',
    });
    expect(getArchetypeLabels('investigation')).toEqual({
      name: 'Investigation',
      tier1: 'Surface Observations',
      tier2: 'Leads & Evidence',
      tier3: 'Deep Forensics & Secrets',
      exits: 'Follow Leads',
    });
    expect(getArchetypeLabels('action_stage')).toEqual({
      name: 'Action Stage',
      tier1: 'The Stage',
      tier2: 'Tools & Complications',
      tier3: 'Hidden Threats',
      exits: 'Outcomes',
    });
    expect(getArchetypeLabels('unknown')).toEqual({
      name: 'Scene',
      tier1: 'Details',
      tier2: 'Interactive',
      tier3: 'Hidden',
      exits: 'Exits',
    });
  });

  it('computes effective connection state from overrides, unlocking items, and base state', () => {
    const unlockingMap = buildUnlockingItemsByConnection(sampleChunk.scenes);
    const connX01 = sampleChunk.connections.find((c) => c.id === 'a1-x01')!;
    const connX03 = sampleChunk.connections.find((c) => c.id === 'a1-x03')!;

    expect(getEffectiveConnectionState(connX01, {}, {}, unlockingMap)).toBe('sealed');
    expect(
      getEffectiveConnectionState(connX01, {}, { 'a1-s01-i1': true }, unlockingMap)
    ).toBe('open');
    expect(
      getEffectiveConnectionState(
        connX01,
        { 'a1-x01': 'locked' },
        { 'a1-s01-i1': true },
        unlockingMap
      )
    ).toBe('locked');

    expect(getEffectiveConnectionState(connX03, {}, {}, unlockingMap)).toBe('hidden');
    expect(
      getEffectiveConnectionState(connX03, {}, { 'a1-s03-i1': true }, unlockingMap)
    ).toBe('open');
  });

  it('computes scene reachability and visibility under GM and Solo Mask modes', () => {
    // At start in a1-s01, a1-x01 is sealed so nothing else is reachable
    const reachInitial = computeReachableSceneIds({
      visited: { 'a1-s01': true },
      currentSceneId: 'a1-s01',
      connections: sampleChunk.connections,
      connectionState: {},
      revealed: {},
      scenes: sampleChunk.scenes,
    });
    expect(reachInitial.has('a1-s02')).toBe(false);

    // GM mode: all scenes are visible
    expect(
      getSceneVisibility({
        sceneId: 'a1-s02',
        soloMask: false,
        visited: { 'a1-s01': true },
        currentSceneId: 'a1-s01',
        reachable: reachInitial,
      })
    ).toBe('visible');

    // Solo mode: unvisited & unreachable -> hidden
    expect(
      getSceneVisibility({
        sceneId: 'a1-s02',
        soloMask: true,
        visited: { 'a1-s01': true },
        currentSceneId: 'a1-s01',
        reachable: reachInitial,
      })
    ).toBe('hidden');

    // Reveal a1-s01-i1 -> a1-x01 opens -> a1-s02 becomes reachable (masked as ???)
    const reachAfterAirlock = computeReachableSceneIds({
      visited: { 'a1-s01': true },
      currentSceneId: 'a1-s01',
      connections: sampleChunk.connections,
      connectionState: {},
      revealed: { 'a1-s01-i1': true },
      scenes: sampleChunk.scenes,
    });
    expect(reachAfterAirlock.has('a1-s02')).toBe(true);
    expect(
      getSceneVisibility({
        sceneId: 'a1-s02',
        soloMask: true,
        visited: { 'a1-s01': true },
        currentSceneId: 'a1-s01',
        reachable: reachAfterAirlock,
      })
    ).toBe('masked');
  });

  it('masks Tier 2 and Tier 3 items according to Solo Mask rules', () => {
    const s1 = sampleChunk.scenes[0];
    const t2Item = s1.tier2_interactive[0]; // Airlock control panel
    const t3Item = s1.tier3_hidden[0]; // Torn vent cover

    // GM mode, unrevealed
    const gmT2 = getMaskedItemView(t2Item, 2, false, {});
    expect(gmT2.label).toBe('Airlock control panel');
    expect(gmT2.showResult).toBe(true);
    expect(gmT2.actionButtonLabel).toBe('Mark found');

    // Solo mode, unrevealed Tier 2: label & check visible, result hidden
    const soloT2 = getMaskedItemView(t2Item, 2, true, {});
    expect(soloT2.label).toBe('Airlock control panel');
    expect(soloT2.checkText).toBe('Computers 40%');
    expect(soloT2.showResult).toBe(false);
    expect(soloT2.showHiddenResultHint).toBe(true);
    expect(soloT2.actionButtonLabel).toBe('Reveal');

    // Solo mode, unrevealed Tier 3: whole item masked
    const soloT3 = getMaskedItemView(t3Item, 3, true, {});
    expect(soloT3.isCardMasked).toBe(true);
    expect(soloT3.kindLabel).toBe('Hidden');
    expect(soloT3.label).toBe('Something is hidden here');
    expect(soloT3.checkText).toBe('Observation 30%');
    expect(soloT3.showResult).toBe(false);
    expect(soloT3.actionButtonLabel).toBe('Reveal');

    // Solo mode, revealed Tier 3: unmasked
    const soloT3Rev = getMaskedItemView(t3Item, 3, true, { [t3Item.id]: true });
    expect(soloT3Rev.isCardMasked).toBe(false);
    expect(soloT3Rev.kindLabel).toBe('Hazard');
    expect(soloT3Rev.label).toBe('Torn vent cover above the airlock');
    expect(soloT3Rev.showResult).toBe(true);
    expect(soloT3Rev.actionButtonLabel).toBe('Revealed');
  });

  it('computes exits for a scene including two_way incoming connections, Solo masking, and unloaded targets', () => {
    const notLoaded = new Set(['a2-s01']);

    // Scene 2 has two_way incoming a1-x01 from a1-s01 and outgoing a1-x02 to a1-s03
    const exitsS2 = getSceneExits({
      sceneId: 'a1-s02',
      connections: sampleChunk.connections,
      scenes: sampleChunk.scenes,
      notLoadedTargets: notLoaded,
      connectionState: { 'a1-x01': 'open' },
      revealed: {},
      soloMask: false,
    });
    expect(exitsS2).toHaveLength(2);
    expect(exitsS2[0].targetSceneId).toBe('a1-s01');
    expect(exitsS2[0].disabled).toBe(false);
    expect(exitsS2[1].targetSceneId).toBe('a1-s03');
    expect(exitsS2[1].disabled).toBe(false);

    // Scene 3 has hidden connection a1-x03 to a1-s04
    const exitsS3Solo = getSceneExits({
      sceneId: 'a1-s03',
      connections: sampleChunk.connections,
      scenes: sampleChunk.scenes,
      notLoadedTargets: notLoaded,
      connectionState: {},
      revealed: {},
      soloMask: true,
    });
    const hiddenExitSolo = exitsS3Solo.find((e) => e.connectionId === 'a1-x03')!;
    expect(hiddenExitSolo.label).toBe('???');
    expect(hiddenExitSolo.stateLabel).toBe('Unrevealed');
    expect(hiddenExitSolo.disabled).toBe(true);

    // Scene 4 has connection a1-x04 to unloaded a2-s01
    const exitsS4 = getSceneExits({
      sceneId: 'a1-s04',
      connections: sampleChunk.connections,
      scenes: sampleChunk.scenes,
      notLoadedTargets: notLoaded,
      connectionState: {},
      revealed: {},
      soloMask: false,
    });
    const unloadedExit = exitsS4.find((e) => e.connectionId === 'a1-x04')!;
    expect(unloadedExit.stateLabel).toBe('Not loaded');
    expect(unloadedExit.disabled).toBe(true);
  });

  it('searches across scenes, entities, items, truths, factions, and tables, and hides masked records in Solo Mask', () => {
    // GM Mode: finds Okafor, terminal, Torn vent cover, Helix, Relay Encounters
    const gmOkafor = searchModuleRecords({
      query: 'okafor',
      scenes: sampleChunk.scenes,
      entities: sampleChunk.entities,
      truths: sampleChunk.truths,
      factions: sampleChunk.factions,
      randomTables: sampleChunk.random_tables,
      connections: sampleChunk.connections,
      connectionState: {},
      visited: { 'a1-s01': true },
      revealed: {},
      currentSceneId: 'a1-s01',
      soloMask: false,
    });
    expect(gmOkafor.some((r) => r.type === 'entity' && r.id === 'e-okafor')).toBe(true);

    const gmVent = searchModuleRecords({
      query: 'torn vent',
      scenes: sampleChunk.scenes,
      entities: sampleChunk.entities,
      truths: sampleChunk.truths,
      factions: sampleChunk.factions,
      randomTables: sampleChunk.random_tables,
      connections: sampleChunk.connections,
      connectionState: {},
      visited: { 'a1-s01': true },
      revealed: {},
      currentSceneId: 'a1-s01',
      soloMask: false,
    });
    expect(gmVent.some((r) => r.type === 'item' && r.id === 'a1-s01-h1')).toBe(true);

    // Solo Mode at Scene 1: Tier 3 item a1-s01-h1 ("Torn vent cover") is unrevealed -> hidden from search
    const soloVent = searchModuleRecords({
      query: 'torn vent',
      scenes: sampleChunk.scenes,
      entities: sampleChunk.entities,
      truths: sampleChunk.truths,
      factions: sampleChunk.factions,
      randomTables: sampleChunk.random_tables,
      connections: sampleChunk.connections,
      connectionState: {},
      visited: { 'a1-s01': true },
      revealed: {},
      currentSceneId: 'a1-s01',
      soloMask: true,
    });
    expect(soloVent).toHaveLength(0);

    // Solo Mode at Scene 1: Scene 2 (where Okafor is) is unvisited -> Okafor is hidden from search
    const soloOkaforUnvisited = searchModuleRecords({
      query: 'okafor',
      scenes: sampleChunk.scenes,
      entities: sampleChunk.entities,
      truths: sampleChunk.truths,
      factions: sampleChunk.factions,
      randomTables: sampleChunk.random_tables,
      connections: sampleChunk.connections,
      connectionState: {},
      visited: { 'a1-s01': true },
      revealed: {},
      currentSceneId: 'a1-s01',
      soloMask: true,
    });
    expect(soloOkaforUnvisited.some((r) => r.id === 'e-okafor')).toBe(false);

    // Once Scene 2 is visited, Okafor is found in Solo Mode
    const soloOkaforVisited = searchModuleRecords({
      query: 'okafor',
      scenes: sampleChunk.scenes,
      entities: sampleChunk.entities,
      truths: sampleChunk.truths,
      factions: sampleChunk.factions,
      randomTables: sampleChunk.random_tables,
      connections: sampleChunk.connections,
      connectionState: {},
      visited: { 'a1-s01': true, 'a1-s02': true },
      revealed: {},
      currentSceneId: 'a1-s02',
      soloMask: true,
    });
    expect(soloOkaforVisited.some((r) => r.id === 'e-okafor')).toBe(true);
  });
});
