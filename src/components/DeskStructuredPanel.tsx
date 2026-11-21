import React, { useMemo, useRef, useState } from 'react';
import {
  getEffectiveClocks,
  getEffectiveConnections,
  getEffectiveFactions,
  getEffectiveScenes,
  getEffectiveTruths,
} from '../lib/improvised';
import {
  computeReachableSceneIds,
  getSceneVisibility,
  getSoloVisibleEntityIds,
} from '../lib/solo';
import { playTactileClick } from '../lib/sound';
import type { DeskCardType } from '../storage/types';
import { useCampaignStore } from '../store/campaignStore';

export interface SendToDeskRequest {
  type: DeskCardType;
  title?: string;
  targetId?: string | null;
  followCurrentScene?: boolean;
  pageNumber?: number;
}

export interface DeskStructuredPanelProps {
  open: boolean;
  onClose: () => void;
  onSendToDesk: (req: SendToDeskRequest) => void;
  onOpenEntityInspector?: (entityId: string) => void;
}

type StructuredTab = 'scenes' | 'tools' | 'assets';

export const DeskStructuredPanel: React.FC<DeskStructuredPanelProps> = ({
  open,
  onClose,
  onSendToDesk,
  onOpenEntityInspector,
}) => {
  const { merged, live, pdfInfo, goToScene } = useCampaignStore();
  const [tab, setTab] = useState<StructuredTab>('scenes');
  const [lastSentKey, setLastSentKey] = useState<string | null>(null);
  const swipeStartRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  const effectiveScenes = useMemo(
    () => getEffectiveScenes(merged.scenes, live),
    [merged.scenes, live]
  );
  const effectiveConnections = useMemo(
    () => getEffectiveConnections(merged.connections, live),
    [merged.connections, live]
  );
  const currentSceneId = live?.currentSceneId ?? effectiveScenes[0]?.id ?? null;
  const currentScene = useMemo(
    () => effectiveScenes.find((s) => s.id === currentSceneId) ?? null,
    [effectiveScenes, currentSceneId]
  );
  const visited = live?.visited ?? {};
  const revealed = live?.revealed ?? {};
  const connectionState = live?.connectionState ?? {};
  const soloMask = Boolean(live?.ui?.soloMask);

  const reachable = useMemo(
    () =>
      computeReachableSceneIds({
        visited,
        currentSceneId,
        connections: effectiveConnections,
        connectionState,
        revealed,
        scenes: effectiveScenes,
      }),
    [visited, currentSceneId, effectiveConnections, connectionState, revealed, effectiveScenes]
  );

  const visibleScenes = useMemo(
    () =>
      effectiveScenes.filter((s) => {
        const vis = getSceneVisibility({
          sceneId: s.id,
          soloMask,
          visited,
          currentSceneId,
          reachable,
        });
        return vis !== 'hidden';
      }),
    [effectiveScenes, soloMask, visited, currentSceneId, reachable]
  );

  const sceneEntities = useMemo(() => {
    if (!currentScene) return [];
    const baseIds = new Set<string>(currentScene.entity_ids ?? []);
    const summonedIds = live?.summoned?.[currentScene.id] ?? [];
    for (const id of summonedIds) baseIds.add(id);
    const base = merged.entities.filter((e) => baseIds.has(e.id));
    const improvised = (live?.improvisedEntities ?? []).filter(
      (e) => e.sceneId === currentScene.id
    );
    return [
      ...base.map((e) => ({ id: e.id, name: e.name, subtitle: e.type })),
      ...improvised.map((e) => ({ id: e.id, name: e.name, subtitle: 'improvised' })),
    ];
  }, [currentScene, live, merged.entities]);

  const soloVisibleEntityIds = useMemo(
    () =>
      getSoloVisibleEntityIds({
        scenes: effectiveScenes,
        entities: merged.entities,
        improvisedEntities: live?.improvisedEntities ?? [],
        visited,
        summoned: live?.summoned ?? {},
        currentSceneId,
        soloMask,
      }),
    [effectiveScenes, merged.entities, live?.improvisedEntities, visited, live?.summoned, currentSceneId, soloMask]
  );

  const allEntities = useMemo(() => {
    const base = merged.entities
      .filter((e) => soloVisibleEntityIds.has(e.id))
      .map((e) => ({
        id: e.id,
        name: e.name,
        subtitle: e.type,
      }));
    const improvised = (live?.improvisedEntities ?? [])
      .filter((e) => soloVisibleEntityIds.has(e.id))
      .map((e) => ({
        id: e.id,
        name: e.name,
        subtitle: 'improvised',
      }));
    return [...base, ...improvised];
  }, [merged.entities, live?.improvisedEntities, soloVisibleEntityIds]);

  const effectiveClocks = getEffectiveClocks(merged.clocks, live);
  const effectiveTruths = getEffectiveTruths(merged.truths, live);
  const effectiveFactions = getEffectiveFactions(merged.factions, live);
  const maps = live?.maps ?? [];

  const triggerSend = (key: string, req: SendToDeskRequest) => {
    playTactileClick();
    onSendToDesk(req);
    setLastSentKey(key);
    window.setTimeout(() => {
      setLastSentKey((prev) => (prev === key ? null : prev));
    }, 1100);
  };

  const handlePanelPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    swipeStartRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
  };

  const handlePanelPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dx <= -60 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      swipeStartRef.current = null;
      onClose();
    }
  };

  const handlePanelPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.pointerId !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dx <= -60 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      onClose();
    }
  };

  const sendBtnStyle = (sent: boolean): React.CSSProperties => ({
    height: '44px',
    minWidth: '76px',
    padding: '0 10px',
    borderRadius: '8px',
    border: sent ? '1px solid var(--tealLine)' : '1px solid var(--accent)',
    background: sent ? 'var(--tealBg)' : 'var(--accentBg)',
    color: sent ? 'var(--teal)' : 'var(--accent)',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
  });

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    height: '44px',
    borderRadius: '8px',
    border: active ? '1px solid var(--accent)' : '1px solid var(--line)',
    background: active ? 'var(--accentBg)' : 'var(--p2)',
    color: active ? 'var(--accent)' : 'var(--text)',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
  });

  if (!open) {
    return null;
  }

  return (
    <>
      {/* Outside tap backdrop */}
      <div
        data-testid="desk-structured-backdrop"
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.35)',
          zIndex: 35,
        }}
      />

      {/* Slide-out panel */}
      <aside
        data-testid="desk-structured-panel"
        aria-label="Structured View Panel"
        onPointerDown={handlePanelPointerDown}
        onPointerMove={handlePanelPointerMove}
        onPointerUp={handlePanelPointerUp}
        onPointerCancel={() => {
          swipeStartRef.current = null;
        }}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: '380px',
          maxWidth: 'calc(100vw - 48px)',
          background: 'var(--panel)',
          borderRight: '1px solid var(--line2)',
          boxShadow: '8px 0 28px rgba(0, 0, 0, 0.4)',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          touchAction: 'pan-y',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderBottom: '1px solid var(--line)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
            }}
          >
            Structured View · Send to Desk
          </span>
          <button
            type="button"
            data-testid="desk-structured-close"
            aria-label="Close Structured panel"
            onClick={onClose}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              background: 'var(--p3)',
              color: 'var(--text)',
              fontSize: '18px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            padding: '10px 12px',
            borderBottom: '1px solid var(--line)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            data-testid="desk-structured-tab-scenes"
            aria-pressed={tab === 'scenes'}
            onClick={() => setTab('scenes')}
            style={tabBtnStyle(tab === 'scenes')}
          >
            Scenes
          </button>
          <button
            type="button"
            data-testid="desk-structured-tab-tools"
            aria-pressed={tab === 'tools'}
            onClick={() => setTab('tools')}
            style={tabBtnStyle(tab === 'tools')}
          >
            Tools
          </button>
          <button
            type="button"
            data-testid="desk-structured-tab-assets"
            aria-pressed={tab === 'assets'}
            onClick={() => setTab('assets')}
            style={tabBtnStyle(tab === 'assets')}
          >
            Assets
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            touchAction: 'pan-y',
          }}
        >
          {tab === 'scenes' && (
            <>
              {/* Quick send Follow Scene / Scene List / Node Map */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '10px',
                  borderRadius: '10px',
                  background: 'var(--p2)',
                  border: '1px solid var(--line)',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--muted)',
                  }}
                >
                  Navigation Cards
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    data-testid="send-to-desk-follow-scene"
                    onClick={() =>
                      triggerSend('follow-scene', {
                        type: 'scene',
                        title: currentScene
                          ? `${currentScene.code} · ${currentScene.title}`
                          : 'Current Scene',
                        followCurrentScene: true,
                      })
                    }
                    style={{ ...sendBtnStyle(lastSentKey === 'follow-scene'), flex: 1 }}
                  >
                    {lastSentKey === 'follow-scene' ? 'Sent' : '+ Follow Scene'}
                  </button>
                  <button
                    type="button"
                    data-testid="send-to-desk-scene-list"
                    onClick={() =>
                      triggerSend('scene-list', {
                        type: 'scene-list',
                        title: 'Scenes',
                      })
                    }
                    style={{ ...sendBtnStyle(lastSentKey === 'scene-list'), flex: 1 }}
                  >
                    {lastSentKey === 'scene-list' ? 'Sent' : '+ Scene List'}
                  </button>
                  <button
                    type="button"
                    data-testid="send-to-desk-node-map"
                    onClick={() =>
                      triggerSend('node-map', {
                        type: 'node-map',
                        title: 'Node Map',
                      })
                    }
                    style={{ ...sendBtnStyle(lastSentKey === 'node-map'), flex: 1 }}
                  >
                    {lastSentKey === 'node-map' ? 'Sent' : '+ Node Map'}
                  </button>
                </div>
              </div>

              {/* Scenes list with Send to Desk */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                  }}
                >
                  Scenes ({visibleScenes.length})
                </div>
                {visibleScenes.map((scene) => {
                  const vis = getSceneVisibility({
                    sceneId: scene.id,
                    soloMask,
                    visited,
                    currentSceneId,
                    reachable,
                  });
                  const masked = vis === 'masked';
                  const isCurrent = scene.id === currentSceneId;
                  const sendKey = `scene:${scene.id}`;
                  return (
                    <div
                      key={scene.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          playTactileClick();
                          goToScene(scene.id);
                        }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          minHeight: '44px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: isCurrent
                            ? '1px solid var(--accent)'
                            : '1px solid var(--line)',
                          background: isCurrent ? 'var(--accentBg)' : 'var(--p2)',
                          color: 'var(--text)',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--mono)',
                            fontSize: '12px',
                            color: isCurrent ? 'var(--accent)' : 'var(--muted)',
                            flexShrink: 0,
                          }}
                        >
                          {masked ? '???' : scene.code}
                        </span>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: isCurrent ? 700 : 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {masked ? '???' : scene.title}
                        </span>
                      </button>
                      <button
                        type="button"
                        data-testid={`send-to-desk-scene-${scene.id}`}
                        disabled={masked}
                        onClick={() => {
                          if (masked) return;
                          triggerSend(sendKey, {
                            type: 'scene',
                            title: `${scene.code} · ${scene.title}`,
                            targetId: scene.id,
                            followCurrentScene: false,
                          });
                        }}
                        style={
                          masked
                            ? {
                                ...sendBtnStyle(false),
                                border: '1px solid var(--line)',
                                background: 'var(--p3)',
                                color: 'var(--faint)',
                                cursor: 'not-allowed',
                              }
                            : sendBtnStyle(lastSentKey === sendKey)
                        }
                      >
                        {masked
                          ? 'Visit first'
                          : lastSentKey === sendKey
                            ? 'Sent'
                            : '+ Desk'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* In This Scene Entities */}
              {sceneEntities.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                    }}
                  >
                    In This Scene ({sceneEntities.length})
                  </div>
                  {sceneEntities.map((ent) => {
                    const sendKey = `entity:${ent.id}`;
                    return (
                      <div
                        key={ent.id}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <button
                          type="button"
                          onClick={() => onOpenEntityInspector?.(ent.id)}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            minHeight: '44px',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid var(--line)',
                            background: 'var(--p2)',
                            color: 'var(--text)',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{ent.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            {ent.subtitle}
                          </div>
                        </button>
                        <button
                          type="button"
                          data-testid={`send-to-desk-entity-${ent.id}`}
                          onClick={() =>
                            triggerSend(sendKey, {
                              type: 'sheet',
                              title: ent.name,
                              targetId: ent.id,
                            })
                          }
                          style={sendBtnStyle(lastSentKey === sendKey)}
                        >
                          {lastSentKey === sendKey ? 'Sent' : '+ Desk'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {tab === 'tools' && (
            <>
              {/* Trackers */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                  }}
                >
                  Trackers ({merged.trackers.length})
                </div>
                {merged.trackers.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    No trackers in this campaign.
                  </div>
                ) : (
                  merged.trackers.map((t) => {
                    const val = live?.trackerValues?.[t.id] ?? t.start;
                    const sendKey = `tracker:${t.id}`;
                    return (
                      <div
                        key={t.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: 'var(--p2)',
                          border: '1px solid var(--line)',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.label}</div>
                          <div
                            className="gm-tabular"
                            style={{
                              fontFamily: 'var(--mono)',
                              fontSize: '12px',
                              color: 'var(--accent)',
                            }}
                          >
                            Value: {val} ({t.min}–{t.max})
                          </div>
                        </div>
                        <button
                          type="button"
                          data-testid={`send-to-desk-tracker-${t.id}`}
                          onClick={() =>
                            triggerSend(sendKey, {
                              type: 'tracker',
                              title: t.label,
                              targetId: t.id,
                            })
                          }
                          style={sendBtnStyle(lastSentKey === sendKey)}
                        >
                          {lastSentKey === sendKey ? 'Sent' : '+ Desk'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Campaign Tools */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                  }}
                >
                  Campaign Tools
                </div>
                {(
                  [
                    {
                      type: 'clocks' as DeskCardType,
                      label: 'Clocks',
                      detail: `${effectiveClocks.length} clocks`,
                    },
                    {
                      type: 'timeline' as DeskCardType,
                      label: 'Timeline',
                      detail: `${merged.timeline.length} events`,
                    },
                    {
                      type: 'clue-matrix' as DeskCardType,
                      label: 'Clue Matrix',
                      detail: `${effectiveTruths.length} truths`,
                    },
                    {
                      type: 'factions' as DeskCardType,
                      label: 'Factions',
                      detail: `${effectiveFactions.length} factions`,
                    },
                    {
                      type: 'random-tables' as DeskCardType,
                      label: 'Random Tables',
                      detail: `${merged.random_tables.length} tables`,
                    },
                    {
                      type: 'notes' as DeskCardType,
                      label: 'Notes & Scratchpad',
                      detail: `${(live?.notes ?? []).length} scene · ${(live?.looseNotes ?? []).length} loose`,
                    },
                  ] as const
                ).map((tool) => {
                  const sendKey = `tool:${tool.type}`;
                  return (
                    <div
                      key={tool.type}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: 'var(--p2)',
                        border: '1px solid var(--line)',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{tool.label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          {tool.detail}
                        </div>
                      </div>
                      <button
                        type="button"
                        data-testid={`send-to-desk-${tool.type}`}
                        onClick={() =>
                          triggerSend(sendKey, {
                            type: tool.type,
                            title: tool.label,
                          })
                        }
                        style={sendBtnStyle(lastSentKey === sendKey)}
                      >
                        {lastSentKey === sendKey ? 'Sent' : '+ Desk'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'assets' && (
            <>
              {/* Source PDF */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: 'var(--p2)',
                  border: '1px solid var(--line)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>Source PDF</div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {pdfInfo ? pdfInfo.fileName : 'No PDF attached'}
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="send-to-desk-pdf"
                  onClick={() =>
                    triggerSend('pdf', {
                      type: 'pdf',
                      title: pdfInfo ? pdfInfo.fileName : 'Source PDF',
                      pageNumber: currentScene?.page ?? 1,
                    })
                  }
                  style={sendBtnStyle(lastSentKey === 'pdf')}
                >
                  {lastSentKey === 'pdf' ? 'Sent' : '+ Desk'}
                </button>
              </div>

              {/* Maps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                  }}
                >
                  Maps ({maps.length})
                </div>
                {maps.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    No maps saved yet.
                  </div>
                ) : (
                  maps.map((m) => {
                    const sendKey = `map:${m.id}`;
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: 'var(--p2)',
                          border: '1px solid var(--line)',
                        }}
                      >
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{m.name}</div>
                        <button
                          type="button"
                          data-testid={`send-to-desk-map-${m.id}`}
                          onClick={() =>
                            triggerSend(sendKey, {
                              type: 'map',
                              title: m.name,
                              targetId: m.id,
                            })
                          }
                          style={sendBtnStyle(lastSentKey === sendKey)}
                        >
                          {lastSentKey === sendKey ? 'Sent' : '+ Desk'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* All Entities */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                  }}
                >
                  Characters & Entities ({allEntities.length})
                </div>
                {allEntities.map((ent) => {
                  const sendKey = `asset-entity:${ent.id}`;
                  return (
                    <div
                      key={ent.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: 'var(--p2)',
                        border: '1px solid var(--line)',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{ent.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          {ent.subtitle}
                        </div>
                      </div>
                      <button
                        type="button"
                        data-testid={`send-to-desk-asset-entity-${ent.id}`}
                        onClick={() =>
                          triggerSend(sendKey, {
                            type: 'sheet',
                            title: ent.name,
                            targetId: ent.id,
                          })
                        }
                        style={sendBtnStyle(lastSentKey === sendKey)}
                      >
                        {lastSentKey === sendKey ? 'Sent' : '+ Desk'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
};
