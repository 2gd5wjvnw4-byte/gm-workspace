import React from 'react';
import { getEffectiveConnections, getEffectiveScenes } from '../lib/improvised';
import { computeReachableSceneIds, getSceneVisibility } from '../lib/solo';
import { playTactileClick } from '../lib/sound';
import type { DeskCardRecord, DeskLinkOpenMode } from '../storage/types';
import { useCampaignStore } from '../store/campaignStore';

export interface DeskSceneListCardBodyProps {
  card: DeskCardRecord;
  linkOpenMode: DeskLinkOpenMode;
  onSpawnSceneCard: (sceneId: string, nearCard: DeskCardRecord) => void;
}

export const DeskSceneListCardBody: React.FC<DeskSceneListCardBodyProps> = ({
  card,
  linkOpenMode,
  onSpawnSceneCard,
}) => {
  const { merged, live, goToScene } = useCampaignStore();

  const effectiveScenes = getEffectiveScenes(merged.scenes, live);
  const effectiveConnections = getEffectiveConnections(merged.connections, live);
  const currentSceneId = live?.currentSceneId ?? effectiveScenes[0]?.id ?? null;
  const visited = live?.visited ?? {};
  const revealed = live?.revealed ?? {};
  const connectionState = live?.connectionState ?? {};
  const soloMask = Boolean(live?.ui?.soloMask);

  const reachable = computeReachableSceneIds({
    visited,
    currentSceneId,
    connections: effectiveConnections,
    connectionState,
    revealed,
    scenes: effectiveScenes,
  });

  if (effectiveScenes.length === 0) {
    return (
      <div
        style={{
          padding: '12px',
          borderRadius: '10px',
          background: 'var(--p2)',
          border: '1px dashed var(--line2)',
          color: 'var(--muted)',
          fontSize: '13px',
          textAlign: 'center',
        }}
      >
        No scenes loaded yet.
      </div>
    );
  }

  // Group by act then scene.group
  const actMap = new Map(merged.acts.map((a) => [a.id, a]));
  const actOrder: string[] = [];
  for (const act of merged.acts) {
    if (!actOrder.includes(act.id)) actOrder.push(act.id);
  }
  for (const s of effectiveScenes) {
    if (!actOrder.includes(s.act_id)) actOrder.push(s.act_id);
  }

  const handleOpenScene = (sceneId: string) => {
    playTactileClick();
    if (linkOpenMode === 'new-card') {
      onSpawnSceneCard(sceneId, card);
    } else {
      goToScene(sceneId);
    }
  };

  return (
    <div
      data-testid={`desk-scene-list-body-${card.id}`}
      style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
    >
      {actOrder.map((actId) => {
        const act = actMap.get(actId);
        const actScenes = effectiveScenes.filter((s) => s.act_id === actId);
        const visibleScenes = actScenes.filter((s) => {
          const vis = getSceneVisibility({
            sceneId: s.id,
            soloMask,
            visited,
            currentSceneId,
            reachable,
          });
          return vis !== 'hidden';
        });

        if (visibleScenes.length === 0) return null;

        const groups: Array<{ name: string; scenes: typeof visibleScenes }> = [];
        for (const s of visibleScenes) {
          const groupName = s.group?.trim() || 'Scenes';
          let g = groups.find((item) => item.name === groupName);
          if (!g) {
            g = { name: groupName, scenes: [] };
            groups.push(g);
          }
          g.scenes.push(s);
        }

        return (
          <div key={actId} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
              {act ? act.title : actId}
            </div>

            {groups.map((grp) => (
              <div
                key={`${actId}:${grp.name}`}
                style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
              >
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '10px',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--faint)',
                    paddingLeft: '2px',
                  }}
                >
                  {grp.name}
                </div>

                {grp.scenes.map((scene) => {
                  const vis = getSceneVisibility({
                    sceneId: scene.id,
                    soloMask,
                    visited,
                    currentSceneId,
                    reachable,
                  });
                  const isCurrent = scene.id === currentSceneId;
                  const isVisited = Boolean(visited[scene.id]);
                  const masked = vis === 'masked';
                  const chipLabel = isCurrent
                    ? 'Here'
                    : isVisited
                      ? 'Visited'
                      : 'New';
                  const chipColor = isCurrent
                    ? 'var(--accent)'
                    : isVisited
                      ? 'var(--muted)'
                      : 'var(--violet)';

                  return (
                    <button
                      key={scene.id}
                      type="button"
                      data-testid={`desk-scene-list-item-${card.id}-${scene.id}`}
                      onClick={() => handleOpenScene(scene.id)}
                      style={{
                        minHeight: '44px',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: isCurrent
                          ? '1px solid var(--accent)'
                          : '1px solid var(--line)',
                        background: isCurrent ? 'var(--accentBg)' : 'var(--p2)',
                        color: 'var(--text)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          minWidth: 0,
                          flex: 1,
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
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: chipColor,
                          border: `1px solid ${chipColor}`,
                          borderRadius: '5px',
                          padding: '2px 5px',
                          flexShrink: 0,
                        }}
                      >
                        {chipLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};
