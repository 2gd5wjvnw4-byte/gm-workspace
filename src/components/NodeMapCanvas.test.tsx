import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LONG_PRESS_MS, NodeMapCanvas } from './NodeMapCanvas';
import type { ModuleConnection, ModuleScene } from '../lib/import/types';

function firePointer(
  el: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  props: { pointerId?: number; clientX?: number; clientY?: number }
) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(ev, {
    pointerId: props.pointerId ?? 1,
    clientX: props.clientX ?? 0,
    clientY: props.clientY ?? 0,
  });
  act(() => {
    el.dispatchEvent(ev);
  });
}

function makeScene(id: string, title: string, code = id): ModuleScene {
  return {
    id,
    act_id: 'a1',
    code,
    title,
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
    label: `${from}-${to}`,
    two_way: true,
    state,
    requires: null,
    page: 1,
    needs_review: false,
    source_quote: '',
  };
}

describe('NodeMapCanvas', () => {
  const scenes = [
    makeScene('s1', 'Airlock', '01'),
    makeScene('s2', 'Corridor', '02'),
  ];
  const connections = [
    makeConn('c1', 's1', 's2', 'open'),
    makeConn('c2', 's2', 'a2-s01', 'open'),
  ];

  it('renders current-act nodes, not-loaded node, and navigates on tap', () => {
    const onSelectScene = vi.fn();
    render(
      <NodeMapCanvas
        scenes={scenes}
        connections={connections}
        notLoadedTargets={new Set(['a2-s01'])}
        currentSceneId="s1"
        visited={{ s1: true }}
        revealed={{}}
        connectionState={{}}
        soloMask={false}
        nodePositions={{}}
        onSelectScene={onSelectScene}
        onMoveNode={vi.fn()}
        onResetLayout={vi.fn()}
      />
    );

    expect(screen.getByTestId('map-node-s1')).toBeInTheDocument();
    expect(screen.getByTestId('map-node-s2')).toBeInTheDocument();
    const unloaded = screen.getByTestId('map-node-a2-s01');
    expect(unloaded).toBeDisabled();

    fireEvent.click(screen.getByTestId('map-node-s2'));
    expect(onSelectScene).toHaveBeenCalledWith('s2');
  });

  it('supports +, -, FIT buttons and wheel zoom/pan', () => {
    render(
      <NodeMapCanvas
        scenes={scenes}
        connections={connections}
        notLoadedTargets={new Set()}
        currentSceneId="s1"
        visited={{ s1: true }}
        revealed={{}}
        connectionState={{}}
        soloMask={false}
        nodePositions={{}}
        onSelectScene={vi.fn()}
        onMoveNode={vi.fn()}
        onResetLayout={vi.fn()}
      />
    );

    expect(screen.getByTestId('node-map-caption')).toHaveTextContent('100%');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByTestId('node-map-caption')).toHaveTextContent('125%');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByTestId('node-map-caption')).toHaveTextContent('100%');

    const canvas = screen.getByTestId('node-map-canvas');
    fireEvent.wheel(canvas, { ctrlKey: true, deltaY: -40, clientX: 160, clientY: 220 });
    expect(screen.getByTestId('node-map-caption')).not.toHaveTextContent('100%');

    fireEvent.click(screen.getByRole('button', { name: 'Fit to view' }));
    expect(screen.getByTestId('node-map-caption')).toHaveTextContent('100%');
  });

  it('suppresses tap after a pointer drag > 6px', () => {
    const onSelectScene = vi.fn();
    render(
      <NodeMapCanvas
        scenes={scenes}
        connections={connections}
        notLoadedTargets={new Set()}
        currentSceneId="s1"
        visited={{ s1: true }}
        revealed={{}}
        connectionState={{}}
        soloMask={false}
        nodePositions={{}}
        onSelectScene={onSelectScene}
        onMoveNode={vi.fn()}
        onResetLayout={vi.fn()}
      />
    );

    const canvas = screen.getByTestId('node-map-canvas');
    firePointer(canvas, 'pointerdown', { pointerId: 1, clientX: 50, clientY: 50 });
    firePointer(canvas, 'pointermove', { pointerId: 1, clientX: 80, clientY: 50 });
    firePointer(canvas, 'pointerup', { pointerId: 1, clientX: 80, clientY: 50 });

    // Immediate click within 80ms after drag must be suppressed
    fireEvent.click(screen.getByTestId('map-node-s2'));
    expect(onSelectScene).not.toHaveBeenCalled();
  });

  it('supports Arrange mode 500ms long-press drag and Reset layout', () => {
    vi.useFakeTimers();
    const onMoveNode = vi.fn();
    const onResetLayout = vi.fn();

    render(
      <NodeMapCanvas
        scenes={scenes}
        connections={connections}
        notLoadedTargets={new Set()}
        currentSceneId="s1"
        visited={{ s1: true }}
        revealed={{}}
        connectionState={{}}
        soloMask={false}
        nodePositions={{}}
        onSelectScene={vi.fn()}
        onMoveNode={onMoveNode}
        onResetLayout={onResetLayout}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Arrange' }));
    expect(screen.getByText('Reset layout')).toBeInTheDocument();

    const canvas = screen.getByTestId('node-map-canvas');
    const node = screen.getByTestId('map-node-s2');

    firePointer(node, 'pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS + 10);
    });
    firePointer(canvas, 'pointermove', { pointerId: 1, clientX: 160, clientY: 140 });
    firePointer(canvas, 'pointerup', { pointerId: 1, clientX: 160, clientY: 140 });

    expect(onMoveNode).toHaveBeenCalledTimes(1);
    expect(onMoveNode.mock.calls[0][0]).toBe('s2');

    fireEvent.click(screen.getByText('Reset layout'));
    expect(onResetLayout).toHaveBeenCalledWith(['s1', 's2']);

    vi.useRealTimers();
  });

  it('calls onExpand and onClose for Expand / Close buttons', () => {
    const onExpand = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <NodeMapCanvas
        scenes={scenes}
        connections={connections}
        notLoadedTargets={new Set()}
        currentSceneId="s1"
        visited={{ s1: true }}
        revealed={{}}
        connectionState={{}}
        soloMask={false}
        nodePositions={{}}
        onSelectScene={vi.fn()}
        onMoveNode={vi.fn()}
        onResetLayout={vi.fn()}
        onExpand={onExpand}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Expand node map' }));
    expect(onExpand).toHaveBeenCalledTimes(1);

    rerender(
      <NodeMapCanvas
        scenes={scenes}
        connections={connections}
        notLoadedTargets={new Set()}
        currentSceneId="s1"
        visited={{ s1: true }}
        revealed={{}}
        connectionState={{}}
        soloMask={false}
        nodePositions={{}}
        onSelectScene={vi.fn()}
        onMoveNode={vi.fn()}
        onResetLayout={vi.fn()}
        expanded
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close expanded node map' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
