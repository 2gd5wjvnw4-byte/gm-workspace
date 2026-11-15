import { describe, expect, it } from 'vitest';
import {
  getAreasForAct,
  getEffectiveConnections,
  getEffectiveScenes,
  nextImprovisedSceneCode,
  pickNextNodePosition,
} from './improvised';
import { createDefaultLiveState } from '../storage/types';
import type { ModuleConnection, ModuleScene } from './import/types';
import type { NodeMapNode } from './nodeMap';

const makeScene = (id: string, code: string, group = '', act_id = 'a1'): ModuleScene => ({
  id,
  code,
  title: `Scene ${code}`,
  act_id,
  archetype: 'physical_zone',
  group,
  page: 1,
  summary: '',
  tags: [],
  read_aloud: null,
  tier1_sensory: [],
  tier2_interactive: [],
  tier3_hidden: [],
  entity_ids: [],
  entity_counts: {},
  gm_tips: '',
  escalation: [],
  default_map_id: null,
  needs_review: false,
  source_quote: '',
});

const makeConn = (id: string, from: string, to: string): ModuleConnection => ({
  id,
  from,
  to,
  type: 'travel',
  label: 'Door',
  two_way: true,
  state: 'open',
  requires: null,
  page: 1,
  needs_review: false,
  source_quote: '',
});

describe('improvised helpers', () => {
  it('merges improvised scenes and connections without duplicating base IDs', () => {
    const baseScene = makeScene('s1', '01', 'Deck 1');
    const impScene = makeScene('imp-s1', 'X1', 'Deck 2');
    const dupScene = makeScene('s1', 'DUP', 'Deck 1');

    const baseConn = makeConn('c1', 's1', 's2');
    const impConn = makeConn('imp-c1', 's1', 'imp-s1');

    const live = createDefaultLiveState('camp-1');
    live.improvisedScenes = [dupScene, impScene];
    live.improvisedConnections = [impConn];

    const scenes = getEffectiveScenes([baseScene], live);
    expect(scenes.map((s) => s.id)).toEqual(['s1', 'imp-s1']);

    const conns = getEffectiveConnections([baseConn], live);
    expect(conns.map((c) => c.id)).toEqual(['c1', 'imp-c1']);
  });

  it('collects unique areas for an act across scenes and improvisedAreas', () => {
    const live = createDefaultLiveState('camp-1');
    live.improvisedAreas = [
      { id: 'a-1', actId: 'a1', name: 'Lower Deck', createdAt: 1 },
      { id: 'a-2', actId: 'a1', name: 'Upper Deck', createdAt: 2 },
      { id: 'a-3', actId: 'a2', name: 'Act 2 Area', createdAt: 3 },
    ];
    const scenes = [makeScene('s1', '01', 'Upper Deck', 'a1')];
    expect(getAreasForAct('a1', scenes, live)).toEqual(['Upper Deck', 'Lower Deck']);
  });

  it('picks the next unused X-prefixed scene code', () => {
    const scenes = [makeScene('s1', 'X1'), makeScene('s2', 'x2')];
    expect(nextImprovisedSceneCode(scenes)).toBe('X3');
  });

  it('picks a non-overlapping position on the right or next row', () => {
    const makeNode = (id: string, x: number, y: number): NodeMapNode => ({
      id,
      code: id,
      title: id,
      status: 'visited',
      masked: false,
      notLoaded: false,
      x,
      y,
    });
    expect(pickNextNodePosition([])).toEqual({ x: 24, y: 24 });
    expect(pickNextNodePosition([makeNode('n1', 24, 24)])).toEqual({ x: 168, y: 24 });
    expect(
      pickNextNodePosition([
        makeNode('n1', 24, 24),
        makeNode('n2', 168, 24),
        makeNode('n3', 312, 24),
      ])
    ).toEqual({ x: 24, y: 104 });
  });
});
