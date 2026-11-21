import React, { useEffect, useRef, useState } from 'react';
import { getEffectiveScenes } from '../lib/improvised';
import { isSceneVisitedInLive } from '../lib/solo';
import { playTactileClick } from '../lib/sound';
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
  const visited = live?.visited ?? {};
  const soloMask = Boolean(live?.ui?.soloMask);
  const globalCurrentScene =
    effectiveScenes.find((s) => s.id === live?.currentSceneId) ??
    effectiveScenes[0] ??
    null;

  const isFollowing = Boolean(card.followCurrentScene);
  const resolvedScene = isFollowing
    ? globalCurrentScene
    : effectiveScenes.find((s) => s.id === card.targetId) ?? null;

  const isPinnedMasked =
    soloMask &&
    !isFollowing &&
    Boolean(resolvedScene) &&
    !isSceneVisitedInLive(resolvedScene?.id, visited, live?.currentSceneId);

  const selectableScenes = soloMask
    ? effectiveScenes.filter((s) =>
        isSceneVisitedInLive(s.id, visited, live?.currentSceneId)
      )
    : effectiveScenes;

  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isFollowing && pickerOpen) {
      setPickerOpen(false);
    }
  }, [isFollowing, pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        pickerAreaRef.current &&
        !pickerAreaRef.current.contains(e.target as Node)
      ) {
        setPickerOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPickerOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pickerOpen]);

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
        position: 'relative',
      }}
    >
      {/* Scene Card Control Bar */}
      <div
        ref={pickerAreaRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
          flexWrap: 'wrap',
          position: 'relative',
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

        {!isFollowing && (selectableScenes.length > 0 || isPinnedMasked) && (
          <>
            <button
              type="button"
              data-testid={`desk-scene-picker-btn-${card.id}`}
              aria-label="Pinned scene"
              aria-expanded={pickerOpen}
              aria-haspopup="listbox"
              onClick={() => {
                playTactileClick();
                setPickerOpen((v) => !v);
              }}
              style={{
                flex: 1,
                minWidth: '140px',
                height: '44px',
                padding: '0 10px',
                borderRadius: '8px',
                border: pickerOpen
                  ? '1px solid var(--accent)'
                  : '1px solid var(--line)',
                background: 'var(--bg)',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  minWidth: 0,
                }}
              >
                {isPinnedMasked && resolvedScene ? (
                  <>
                    <span
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: '12px',
                        color: 'var(--violet)',
                        flexShrink: 0,
                      }}
                    >
                      ???
                    </span>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      Unvisited Scene
                    </span>
                  </>
                ) : resolvedScene ? (
                  <>
                    <span
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: '12px',
                        color: 'var(--accent)',
                        flexShrink: 0,
                      }}
                    >
                      {resolvedScene.code}
                    </span>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {resolvedScene.title}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                    Pick a scene
                  </span>
                )}
              </span>
              <span
                aria-hidden="true"
                style={{
                  fontSize: '12px',
                  color: 'var(--muted)',
                  flexShrink: 0,
                }}
              >
                {pickerOpen ? '▴' : '▾'}
              </span>
            </button>

            {pickerOpen && (
              <div
                data-testid={`desk-scene-picker-menu-${card.id}`}
                role="listbox"
                aria-label="Pinned scene options"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  maxHeight: '260px',
                  overflowY: 'auto',
                  padding: '8px',
                  borderRadius: '10px',
                  border: '1px solid var(--line2)',
                  background: 'var(--panel)',
                  boxShadow: '0 10px 28px rgba(0, 0, 0, 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  zIndex: 10,
                  touchAction: 'pan-y',
                }}
              >
                {isPinnedMasked && resolvedScene && (
                  <button
                    type="button"
                    role="option"
                    aria-selected={true}
                    disabled
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--violetLine)',
                      background: 'var(--violetBg)',
                      color: 'var(--violet)',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'default',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: '12px',
                        flexShrink: 0,
                      }}
                    >
                      ???
                    </span>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      Unvisited Scene
                    </span>
                  </button>
                )}
                {selectableScenes.map((scene) => {
                  const isSelected = resolvedScene?.id === scene.id;
                  return (
                    <button
                      key={scene.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-testid={`desk-scene-picker-option-${card.id}-${scene.id}`}
                      onClick={() => {
                        playTactileClick();
                        handleSelectPinnedScene(scene.id);
                        setPickerOpen(false);
                      }}
                      style={{
                        width: '100%',
                        minHeight: '44px',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: isSelected
                          ? '1px solid var(--accent)'
                          : '1px solid var(--line)',
                        background: isSelected ? 'var(--accentBg)' : 'var(--p2)',
                        color: 'var(--text)',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: '12px',
                          color: isSelected ? 'var(--accent)' : 'var(--muted)',
                          flexShrink: 0,
                        }}
                      >
                        {scene.code}
                      </span>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: isSelected ? 700 : 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {scene.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
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
        {isPinnedMasked && resolvedScene ? (
          <div
            data-testid={`desk-scene-masked-${card.id}`}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '20px',
              textAlign: 'center',
              color: 'var(--muted)',
              background:
                'repeating-linear-gradient(135deg, var(--panel) 0 10px, var(--stripe) 10px 20px)',
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--violet)' }}>
              Unvisited Scene (Solo Mask)
            </div>
            <div style={{ fontSize: '13px' }}>
              Visit this scene to reveal its contents.
            </div>
            <button
              type="button"
              data-testid={`desk-scene-visit-reveal-${card.id}`}
              onClick={() => {
                goToScene(resolvedScene.id);
                onUpdateCard(card.id, {
                  title: `${resolvedScene.code} · ${resolvedScene.title}`,
                });
              }}
              style={{
                height: '44px',
                padding: '0 14px',
                borderRadius: '8px',
                border: '1px solid var(--violetLine)',
                background: 'var(--violetBg)',
                color: 'var(--violet)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Visit &amp; Reveal
            </button>
          </div>
        ) : resolvedScene ? (
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
