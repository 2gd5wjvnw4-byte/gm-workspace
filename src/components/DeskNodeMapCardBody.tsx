import React from 'react';
import { getEffectiveConnections, getEffectiveScenes } from '../lib/improvised';
import type { DeskCardRecord, DeskLinkOpenMode } from '../storage/types';
import { useCampaignStore } from '../store/campaignStore';
import { NodeMapCanvas } from './NodeMapCanvas';

export interface DeskNodeMapCardBodyProps {
  card: DeskCardRecord;
  linkOpenMode: DeskLinkOpenMode;
  onSpawnSceneCard: (sceneId: string, nearCard: DeskCardRecord) => void;
}

export const DeskNodeMapCardBody: React.FC<DeskNodeMapCardBodyProps> = ({
  card,
  linkOpenMode,
  onSpawnSceneCard,
}) => {
  const {
    merged,
    live,
    goToScene,
    setNodePosition,
    resetNodePositions,
  } = useCampaignStore();

  const effectiveScenes = getEffectiveScenes(merged.scenes, live);
  const effectiveConnections = getEffectiveConnections(merged.connections, live);
  const currentSceneId = live?.currentSceneId ?? effectiveScenes[0]?.id ?? null;

  return (
    <div
      data-testid={`desk-node-map-body-${card.id}`}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        flex: 1,
        minHeight: '260px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <NodeMapCanvas
        scenes={effectiveScenes}
        connections={effectiveConnections}
        notLoadedTargets={merged.linkCheck.notLoadedTargets}
        currentSceneId={currentSceneId}
        visited={live?.visited ?? {}}
        revealed={live?.revealed ?? {}}
        connectionState={live?.connectionState ?? {}}
        soloMask={Boolean(live?.ui?.soloMask)}
        nodePositions={live?.nodePositions ?? {}}
        onSelectScene={(sceneId) => {
          if (linkOpenMode === 'new-card') {
            onSpawnSceneCard(sceneId, card);
          } else {
            goToScene(sceneId);
          }
        }}
        onMoveNode={setNodePosition}
        onResetLayout={resetNodePositions}
      />
    </div>
  );
};
