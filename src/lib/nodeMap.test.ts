import { describe, expect, it } from 'vitest';
import type { ModuleConnection, ModuleScene } from './import/types';
import {
  buildNodeMapGraph,
  computeBfsDefaultPositions,
  NODE_HEIGHT,
  NODE_WIDTH,
} from './nodeMap';

function makeScene(id: string, actId = 'a1', code = id): ModuleScene {
  return {
    id,
    act_id: actId,
    code,
    title: `Scene ${id}`,
    group: 'Main',
    archetype: 'physical_zone',
    page: 1,
    summary: '',
    tags: [],
    read_aloud: null,
    tier1_sensory: [],
    tier2_interactive: [],
    tier3_hidden: [],
    escalation: [],
    gm_tips: '',
    entity_ids: [],
    entity_counts: {},
    default_map_id: null,
    needs_review: false,
    source_quote: '',
  };
}

function makeConn(
  id: string,
  from: string,
  to: string,
  state: ModuleConnection['state'] = 'open'
): ModuleConnection {
  return {
    id,
    from,
    to,
    type: 'door',
    label: `${from} -> ${to}`,
    two_way: true,
    state,
    requires: null,
    page: 1,
    needs_review: false,
    source_quote: '',
  };
}

describe('nodeMap', () => {
  it('lays out nodes by BFS depth with at most 3 per row', () => {
    const ids = ['s0', 's1', 's2', 's3', 's4', 's5'];
    const conns = [
      makeConn('c1', 's0', 's1'),
      makeConn('c2', 's0', 's2'),
      makeConn('c3', 's0', 's3'),
      makeConn('c4', 's0', 's4'),
      makeConn('c5', 's1', 's5'),
    ];
    const pos = computeBfsDefaultPositions(ids, 's0', conns);
    // s0 at depth 0 (row 0)
    // s1..s4 at depth 1 -> split into row 1 (s1, s2, s3) and row 2 (s4)
    // s5 at depth 2 -> row 3
    expect(pos.s0.y).toBeLessThan(pos.s1.y);
    expect(pos.s1.y).toBe(pos.s2.y);
    expect(pos.s2.y).toBe(pos.s3.y);
    expect(pos.s4.y).toBeGreaterThan(pos.s3.y);
    expect(pos.s5.y).toBeGreaterThan(pos.s4.y);
  });

  it('overrides default positions with saved nodePositions', () => {
    const scenes = [makeScene('s0'), makeScene('s1')];
    const conns = [makeConn('c1', 's0', 's1')];
    const graph = buildNodeMapGraph({
      scenes,
      connections: conns,
      notLoadedTargets: new Set(),
      currentSceneId: 's0',
      visited: { s0: true },
      revealed: {},
      connectionState: {},
      soloMask: false,
      nodePositions: { s1: { x: 420, y: 180 } },
    });
    const s1 = graph.nodes.find((n) => n.id === 's1')!;
    expect(s1.x).toBe(420);
    expect(s1.y).toBe(180);
    expect(graph.bounds.maxX).toBe(420 + NODE_WIDTH);
    expect(graph.bounds.maxY).toBe(180 + NODE_HEIGHT);
  });

  it('includes grey not-loaded nodes for unloaded act targets', () => {
    const scenes = [makeScene('a1-s01')];
    const conns = [makeConn('c1', 'a1-s01', 'a2-s01', 'open')];
    const graph = buildNodeMapGraph({
      scenes,
      connections: conns,
      notLoadedTargets: new Set(['a2-s01']),
      currentSceneId: 'a1-s01',
      visited: { 'a1-s01': true },
      revealed: {},
      connectionState: {},
      soloMask: false,
      nodePositions: {},
    });
    const unloaded = graph.nodes.find((n) => n.id === 'a2-s01')!;
    expect(unloaded).toBeDefined();
    expect(unloaded.notLoaded).toBe(true);
    expect(unloaded.status).toBe('not-loaded');
    expect(graph.edges[0].solid).toBe(false);
  });

  it('applies Solo Mask rules: hides unreachable unvisited scenes and masks reachable ones as ???', () => {
    const scenes = [
      makeScene('s0', 'a1', '00'),
      makeScene('s1', 'a1', '01'),
      makeScene('s2', 'a1', '02'),
    ];
    const conns = [
      makeConn('c1', 's0', 's1', 'open'),
      makeConn('c2', 's0', 's2', 'hidden'),
    ];
    const graph = buildNodeMapGraph({
      scenes,
      connections: conns,
      notLoadedTargets: new Set(),
      currentSceneId: 's0',
      visited: { s0: true },
      revealed: {},
      connectionState: {},
      soloMask: true,
      nodePositions: {},
    });
    expect(graph.nodes.map((n) => n.id)).toEqual(['s0', 's1']);
    const s1 = graph.nodes.find((n) => n.id === 's1')!;
    expect(s1.masked).toBe(true);
    expect(s1.title).toBe('???');
    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0].solid).toBe(true);
  });

  it('handles 30 scenes cleanly without overlaps', () => {
    const scenes = Array.from({ length: 30 }, (_, i) => makeScene(`s${i}`, 'a1', `${i}`));
    const conns = scenes.slice(1).map((s, i) => makeConn(`c${i}`, `s${i}`, s.id));
    const graph = buildNodeMapGraph({
      scenes,
      connections: conns,
      notLoadedTargets: new Set(),
      currentSceneId: 's0',
      visited: { s0: true },
      revealed: {},
      connectionState: {},
      soloMask: false,
      nodePositions: {},
    });
    expect(graph.nodes).toHaveLength(30);
    expect(graph.edges).toHaveLength(29);
    const coords = new Set(graph.nodes.map((n) => `${n.x},${n.y}`));
    expect(coords.size).toBe(30);
  });
});
