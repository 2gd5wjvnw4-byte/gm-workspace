import React from 'react';
import { getEffectiveScenes } from '../lib/improvised';
import type {
  DeskCardRecord,
  DeskLinkOpenMode,
  TableNote,
} from '../storage/types';
import { useCampaignStore } from '../store/campaignStore';
import { Center } from './Center';

export interface DeskSceneCardBodyProps {
  card: DeskCardRecord;
  linkOpenMode: DeskLinkOpenMode;
  onUpdateCard: (
    cardId: string,
    patch: Partial<
      Pick<DeskCardRecord, 'title' | 'targetId' | 'followCurrentScene' | 'pageNumber'>
    >
  ) => void;
  onSpawnSceneCard: (sceneId: string, nearCard: DeskCardRecord) => void;
  onSpawnSheetCard: (entityId: string, nearCard: DeskCardRecord) => void;
  onSpawnPageCard: (printedPage: number, nearCard: DeskCardRecord) => void;
  onOpenPdfInPlace: (printedPage?: number) => void;
  onOpenEntityInspector: (entityId: string) => void;
  onEditNote?: (note: TableNote) => void;
  onOpenMapLibrary?: () => void;
}

export const DeskSceneCardBody: React.FC<DeskSceneCardBodyProps> = ({
  card,
  linkOpenMode,
  onUpdateCard,
  onSpawnSceneCard,
  onSpawnSheetCard,
  onSpawnPageCard,
  onOpenPdfInPlace,
  onOpenEntityInspector,
  onEditNote,
  onOpenMapLibrary,
}) => {
  const { merged, live, goToScene } = useCampaignStore();
  const effectiveScenes = getEffectiveScenes(merged.scenes, live);
  const globalCurrentScene =
    effectiveScenes.find((s) => s.id === live?.currentSceneId) ??
    effectiveScenes[0] ??
    null;

  const isFollowing = Boolean(card.followCurrentScene);
  const resolvedScene = isFollowing
    ? globalCurrentScene
    : effectiveScenes.find((s) => s.id === card.targetId) ?? null;

  const handleToggleFollow = () => {
    if (isFollowing) {
      const pinScene = globalCurrentScene;
      onUpdateCard(card.id, {
        followCurrentScene: false,
        targetId: pinScene?.id ?? null,
        title: pinScene ? `${pinScene.code} · ${pinScene.title}` : card.title,
      });
    } else {
      onUpdateCard(card.id, {
        followCurrentScene: true,
        targetId: null,
        title: globalCurrentScene
          ? `${globalCurrentScene.code} · ${globalCurrentScene.title}`
          : 'Current Scene',
      });
    }
  };

  const handleSelectPinnedScene = (nextSceneId: string) => {
    const nextScene = effectiveScenes.find((s) => s.id === nextSceneId);
    if (!nextScene) return;
    onUpdateCard(card.id, {
      followCurrentScene: false,
      targetId: nextScene.id,
      title: `${nextScene.code} · ${nextScene.title}`,
    });
  };

  const handleSceneLink = (targetSceneId: string) => {
    if (linkOpenMode === 'new-card') {
      onSpawnSceneCard(targetSceneId, card);
      return;
    }
    if (isFollowing) {
      goToScene(targetSceneId);
    } else {
      handleSelectPinnedScene(targetSceneId);
    }
  };

  const handleEntityLink = (entityId: string) => {
    if (linkOpenMode === 'new-card') {
      onSpawnSheetCard(entityId, card);
      return;
    }
    onOpenEntityInspector(entityId);
  };

  const handlePdfLink = (printedPage?: number) => {
    if (linkOpenMode === 'new-card') {
      onSpawnPageCard(printedPage ?? resolvedScene?.page ?? 1, card);
      return;
    }
    onOpenPdfInPlace(printedPage);
  };

  return (
    <div
      data-testid={`desk-scene-card-body-${card.id}`}
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Scene Card Control Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          data-testid={`desk-scene-follow-toggle-${card.id}`}
          aria-pressed={isFollowing}
          onClick={handleToggleFollow}
          style={{
            height: '44px',
            padding: '0 12px',
            borderRadius: '8px',
            border: isFollowing
              ? '1px solid var(--tealLine)'
              : '1px solid var(--line)',
            background: isFollowing ? 'var(--tealBg)' : 'var(--p2)',
            color: isFollowing ? 'var(--teal)' : 'var(--text)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {isFollowing ? 'Following Current' : 'Pinned Scene'}
        </button>

        {!isFollowing && effectiveScenes.length > 0 && (
          <select
            data-testid={`desk-scene-select-${card.id}`}
            aria-label="Pinned scene"
            value={resolvedScene?.id ?? ''}
            onChange={(e) => handleSelectPinnedScene(e.target.value)}
            style={{
              flex: 1,
              minWidth: '140px',
              height: '44px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {effectiveScenes.map((scene) => (
              <option key={scene.id} value={scene.id}>
                #{scene.code} · {scene.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Embedded Center Scene Stage */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '8px',
          border: '1px solid var(--line)',
          overflow: 'hidden',
          background: 'var(--bg)',
        }}
      >
        {resolvedScene ? (
          <Center
            mapMode="off"
            embeddedInDesk
            sceneId={resolvedScene.id}
            onSelectScene={handleSceneLink}
            onOpenPdf={handlePdfLink}
            onEditNote={onEditNote}
            onOpenEntityInspector={handleEntityLink}
            onOpenMapLibrary={onOpenMapLibrary}
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              color: 'var(--muted)',
              fontSize: '13px',
            }}
          >
            No scene loaded.
          </div>
        )}
      </div>
    </div>
  );
};
