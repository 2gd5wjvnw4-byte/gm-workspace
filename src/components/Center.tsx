import React, { useEffect, useMemo, useState } from 'react';
import { ExitsBar } from './ExitsBar';
import { MapArea } from './MapArea';
import type { DispositionState, MapDisplayMode, TableNote } from '../storage/types';
import { getEffectiveConnections, getEffectiveScenes } from '../lib/improvised';
import { buildKeywordTargets, segmentTextByKeywords, type KeywordTarget } from '../lib/keywords';
import { getArchetypeLabels, getMaskedItemView } from '../lib/solo';
import { useFlashConfirm } from '../lib/useFlashConfirm';
import { useCampaignStore } from '../store/campaignStore';
import type { EntityRoleplay, SceneItemKind } from '../lib/import/types';

export interface CenterProps {
  mapMode: MapDisplayMode;
  onOpenPdf?: (printedPage?: number) => void;
  onEditNote?: (note: TableNote) => void;
  onOpenEntityInspector?: (entityId: string) => void;
  onOpenMapLibrary?: () => void;
}

export type SceneViewMode = 'run' | 'full';

export interface KeywordPeekState {
  kind: 'entity' | 'truth';
  targetId: string;
}

const KIND_COLOR_VARS: Record<SceneItemKind | 'hidden', string> = {
  hazard: 'var(--red)',
  clue: 'var(--teal)',
  loot: 'var(--gold)',
  tech: 'var(--blue)',
  social: 'var(--violet)',
  other: 'var(--muted)',
  hidden: 'var(--muted)',
};

const DISPOSITION_COLORS: Record<DispositionState, string> = {
  allied: 'var(--teal)',
  neutral: 'var(--muted)',
  suspicious: 'var(--gold)',
  hostile: 'var(--red)',
};

interface InlineEntityCardModel {
  id: string;
  name: string;
  summary: string;
  statLine: string;
  roleplay: EntityRoleplay | null;
  disposition: DispositionState;
  defaultDisposition: DispositionState;
  copyCount: number;
  tracks: Array<{ label: string; max: number }>;
  isSummoned: boolean;
  isImprovised: boolean;
}

const ANCHOR_PREFIX_RE = /^(Trigger|Check|Loot|Secret):\s*(.+)$/i;

export const Center: React.FC<CenterProps> = ({
  mapMode,
  onOpenPdf,
  onEditNote,
  onOpenEntityInspector,
  onOpenMapLibrary,
}) => {
  const {
    merged,
    live,
    goToScene,
    setScenePin,
    toggleRevealedItem,
    adjustEntityTrack,
    cycleEntityDisposition,
    summonEntityToScene,
    removeSummonedEntityFromScene,
  } = useCampaignStore();

  const [readOpen, setReadOpen] = useState(true);
  const [sceneViewMode, setSceneViewMode] = useState<SceneViewMode>('run');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [expandedEntities, setExpandedEntities] = useState<Record<string, boolean>>({});
  const [activePeek, setActivePeek] = useState<KeywordPeekState | null>(null);
  const { flashedIds, triggerFlash } = useFlashConfirm();

  const effectiveScenes = getEffectiveScenes(merged.scenes, live);
  const effectiveConnections = getEffectiveConnections(merged.connections, live);
  const currentSceneId = live?.currentSceneId ?? effectiveScenes[0]?.id ?? null;
  const currentScene =
    effectiveScenes.find((s) => s.id === currentSceneId) ?? effectiveScenes[0] ?? null;

  useEffect(() => {
    setReadOpen(true);
    setActivePeek(null);
  }, [currentScene?.id]);

  const soloMask = Boolean(live?.ui?.soloMask);
  const revealed = live?.revealed ?? {};
  const visited = live?.visited ?? {};
  const entityTracks = live?.entityTracks ?? {};
  const entityTrackMax = live?.entityTrackMax ?? {};
  const entityDisposition = live?.entityDisposition ?? {};
  const summonedForScene = currentSceneId ? (live?.summoned?.[currentSceneId] ?? []) : [];
  const improvisedEntities = live?.improvisedEntities ?? [];

  const sceneNotes = currentScene
    ? (live?.notes ?? []).filter((n) => n.targetId === currentScene.id)
    : [];

  const scenesWithNotes = useMemo(
    () => new Set((live?.notes ?? []).map((n) => n.targetId)),
    [live?.notes]
  );

  const labels = getArchetypeLabels(
    currentScene ? currentScene.archetype : 'physical_zone'
  );

  // Build "In This Scene" inline entity models
  const entityById = useMemo(
    () => new Map(merged.entities.map((e) => [e.id, e])),
    [merged.entities]
  );

  const inSceneIds: string[] = [];
  if (currentScene) {
    for (const eid of currentScene.entity_ids) {
      if (!inSceneIds.includes(eid) && entityById.has(eid)) {
        inSceneIds.push(eid);
      }
    }
    for (const eid of summonedForScene) {
      if (!inSceneIds.includes(eid) && entityById.has(eid)) {
        inSceneIds.push(eid);
      }
    }
  }

  const sceneEntityCards: InlineEntityCardModel[] = inSceneIds.map((eid) => {
    const ent = entityById.get(eid)!;
    const isSummoned =
      Boolean(currentScene) &&
      !currentScene!.entity_ids.includes(eid) &&
      summonedForScene.includes(eid);
    const countOverride = currentScene?.entity_counts?.[eid];
    const copyCount =
      typeof countOverride === 'number' && countOverride > 0
        ? countOverride
        : Math.max(1, ent.count || 1);
    const disp = entityDisposition[eid] ?? ent.disposition;
    return {
      id: eid,
      name: ent.name,
      summary: ent.summary,
      statLine: ent.stat_line,
      roleplay: ent.roleplay,
      disposition: disp,
      defaultDisposition: ent.disposition,
      copyCount,
      tracks: ent.tracks,
      isSummoned,
      isImprovised: false,
    };
  });

  if (currentSceneId) {
    for (const imp of improvisedEntities) {
      if (imp.sceneId === currentSceneId) {
        const disp = entityDisposition[imp.id] ?? imp.disposition;
        sceneEntityCards.push({
          id: imp.id,
          name: imp.name,
          summary: imp.summary,
          statLine: '',
          roleplay: null,
          disposition: disp,
          defaultDisposition: imp.disposition,
          copyCount: 1,
          tracks: imp.track ? [imp.track] : [],
          isSummoned: false,
          isImprovised: true,
        });
      }
    }
  }

  const roamingEntities = merged.entities.filter(
    (e) => e.roaming && !inSceneIds.includes(e.id)
  );

  // Build keyword targets for inline keyword peek popovers
  const keywordTargets: KeywordTarget[] = useMemo(() => {
    const allowedEntities: Array<{ id: string; name: string }> = [];
    const visitedEntityIds = new Set<string>();
    if (soloMask) {
      for (const s of effectiveScenes) {
        if (Boolean(visited[s.id]) || s.id === currentSceneId) {
          for (const eid of s.entity_ids) visitedEntityIds.add(eid);
          for (const eid of live?.summoned?.[s.id] ?? []) visitedEntityIds.add(eid);
        }
      }
    }
    for (const ent of merged.entities) {
      if (soloMask && !ent.roaming && !visitedEntityIds.has(ent.id)) {
        const placedSomewhere = effectiveScenes.some((s) => s.entity_ids.includes(ent.id));
        if (placedSomewhere) continue;
      }
      allowedEntities.push({ id: ent.id, name: ent.name });
    }
    for (const imp of improvisedEntities) {
      allowedEntities.push({ id: imp.id, name: imp.name });
    }
    return buildKeywordTargets(allowedEntities, merged.truths);
  }, [
    merged.entities,
    merged.truths,
    improvisedEntities,
    effectiveScenes,
    soloMask,
    visited,
    currentSceneId,
    live?.summoned,
  ]);

  const truthById = useMemo(
    () => new Map(merged.truths.map((t) => [t.id, t])),
    [merged.truths]
  );

  const countRevealedCluesForTruth = (truthId: string): { found: number; total: number } => {
    let found = 0;
    let total = 0;
    for (const scene of effectiveScenes) {
      for (const item of [...scene.tier2_interactive, ...scene.tier3_hidden]) {
        if (item.truth_id === truthId) {
          total += 1;
          if (revealed[item.id]) found += 1;
        }
      }
    }
    for (const ent of merged.entities) {
      for (const clue of ent.clues) {
        if (clue.truth_id === truthId) {
          total += 1;
          if (revealed[clue.id]) found += 1;
        }
      }
    }
    return { found, total };
  };

  const renderTextWithKeywords = (text: string): React.ReactNode => {
    const segments = segmentTextByKeywords(text, keywordTargets);
    return segments.map((seg, idx) => {
      if (seg.type === 'text') {
        return <React.Fragment key={idx}>{seg.text}</React.Fragment>;
      }
      return (
        <button
          key={idx}
          type="button"
          data-testid={`keyword-link-${seg.kind}-${seg.targetId}`}
          onClick={(e) => {
            e.stopPropagation();
            setActivePeek({ kind: seg.kind, targetId: seg.targetId });
          }}
          style={{
            all: 'unset',
            cursor: 'pointer',
            color: seg.kind === 'entity' ? 'var(--accent)' : 'var(--teal)',
            borderBottom: `1px dashed ${seg.kind === 'entity' ? 'var(--accent)' : 'var(--teal)'}`,
            fontWeight: 600,
            padding: '0 1px',
            borderRadius: '2px',
          }}
        >
          {seg.text}
        </button>
      );
    });
  };

  const renderAnchoredLine = (line: string): React.ReactNode => {
    const match = ANCHOR_PREFIX_RE.exec(line);
    if (!match) return renderTextWithKeywords(line);
    const [, anchor, rest] = match;
    return (
      <>
        <strong style={{ fontWeight: 700, color: 'var(--text)' }}>{anchor}</strong>{' '}
        <span>{renderTextWithKeywords(rest)}</span>
      </>
    );
  };

  const chipStyle = (colorVar: string): React.CSSProperties => ({
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '.04em',
    textTransform: 'uppercase',
    color: colorVar,
    border: `1px solid ${colorVar}`,
    borderRadius: '6px',
    padding: '2px 6px',
    flexShrink: 0,
  });

  const actionBtnStyle = (isRevealed: boolean): React.CSSProperties => ({
    height: '44px',
    padding: '0 12px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    flexShrink: 0,
    border: isRevealed ? '1px solid var(--tealLine)' : '1px solid var(--line2)',
    background: isRevealed ? 'var(--tealBg)' : 'var(--p3)',
    color: isRevealed ? 'var(--teal)' : 'var(--text)',
    cursor: 'pointer',
  });

  const renderKeywordPopover = () => {
    if (!activePeek) return null;

    if (activePeek.kind === 'entity') {
      const baseEnt = entityById.get(activePeek.targetId);
      const impEnt = improvisedEntities.find((i) => i.id === activePeek.targetId);
      if (!baseEnt && !impEnt) return null;

      const name = baseEnt ? baseEnt.name : impEnt!.name;
      const summary = baseEnt ? baseEnt.summary : impEnt!.summary;
      const statLine = baseEnt ? baseEnt.stat_line : '';
      const disp =
        entityDisposition[activePeek.targetId] ??
        (baseEnt ? baseEnt.disposition : impEnt!.disposition);
      const roleplay = baseEnt?.roleplay ?? null;
      const dispColor = DISPOSITION_COLORS[disp];

      return (
        <div
          data-testid="keyword-peek-backdrop"
          onClick={() => setActivePeek(null)}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 25,
            background: 'rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '48px',
          }}
        >
          <div
            data-testid="keyword-peek-popover"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(420px, calc(100% - 32px))',
              background: 'var(--panel)',
              border: '1px solid var(--accent)',
              borderRadius: '14px',
              boxShadow: '0 16px 36px rgba(0,0,0,0.45)',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                data-testid="keyword-peek-title"
                style={{
                  fontFamily: 'var(--head)',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--text)',
                  flex: 1,
                }}
              >
                {name}
              </span>
              <span style={chipStyle(dispColor)}>{disp}</span>
              <button
                type="button"
                data-testid="keyword-peek-close"
                onClick={() => setActivePeek(null)}
                style={{
                  height: '36px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  background: 'var(--p3)',
                  color: 'var(--text)',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>

            {statLine && (
              <div
                data-testid="keyword-peek-stat-line"
                className="gm-tabular"
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '12px',
                  color: 'var(--text)',
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                }}
              >
                {statLine}
              </div>
            )}

            {summary && (
              <div style={{ fontSize: '13px', color: 'var(--readText)' }}>{summary}</div>
            )}

            {roleplay && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  fontSize: '12px',
                  color: 'var(--muted)',
                }}
              >
                {roleplay.voice && (
                  <div>
                    <strong style={{ color: 'var(--text)' }}>Voice:</strong> {roleplay.voice}
                  </div>
                )}
                {roleplay.goal && (
                  <div>
                    <strong style={{ color: 'var(--text)' }}>Goal:</strong> {roleplay.goal}
                  </div>
                )}
                {roleplay.secret && (
                  <div data-testid="keyword-peek-secret">
                    <strong style={{ color: 'var(--text)' }}>Secret:</strong>{' '}
                    {soloMask ? 'Hidden in Solo Mode.' : roleplay.secret}
                  </div>
                )}
              </div>
            )}

            {onOpenEntityInspector && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  data-testid="keyword-peek-inspect-btn"
                  onClick={() => {
                    const targetId = activePeek.targetId;
                    setActivePeek(null);
                    onOpenEntityInspector(targetId);
                  }}
                  style={{
                    height: '40px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--accent)',
                    background: 'var(--accentBg)',
                    color: 'var(--accent)',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  Open Inspector
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    const truth = truthById.get(activePeek.targetId);
    if (!truth) return null;
    const { found, total } = countRevealedCluesForTruth(truth.id);
    const answerMasked = soloMask && found === 0;

    return (
      <div
        data-testid="keyword-peek-backdrop"
        onClick={() => setActivePeek(null)}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 25,
          background: 'rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: '48px',
        }}
      >
        <div
          data-testid="keyword-peek-popover"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(420px, calc(100% - 32px))',
            background: 'var(--panel)',
            border: '1px solid var(--teal)',
            borderRadius: '14px',
            boxShadow: '0 16px 36px rgba(0,0,0,0.45)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              data-testid="keyword-peek-title"
              style={{
                fontFamily: 'var(--head)',
                fontSize: '17px',
                fontWeight: 700,
                color: 'var(--text)',
                flex: 1,
              }}
            >
              {truth.title}
            </span>
            <span style={chipStyle(truth.importance === 'core' ? 'var(--gold)' : 'var(--teal)')}>
              {truth.importance} · {found}/{total} clues
            </span>
            <button
              type="button"
              data-testid="keyword-peek-close"
              onClick={() => setActivePeek(null)}
              style={{
                height: '36px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'var(--p3)',
                color: 'var(--text)',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              Close
            </button>
          </div>
          <div
            data-testid="keyword-peek-truth-answer"
            style={{ fontSize: '14px', color: 'var(--readText)' }}
          >
            {answerMasked
              ? 'Hidden in Solo Mode until a linked clue is revealed.'
              : truth.text}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main
      data-testid="zone-center"
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: 'var(--bg)',
      }}
    >
      {renderKeywordPopover()}

      {mapMode !== 'off' && (
        <div
          data-testid="center-map-area"
          style={
            mapMode === 'pip'
              ? {
                  position: 'absolute',
                  right: '16px',
                  bottom: '84px',
                  width: '320px',
                  height: '220px',
                  zIndex: 5,
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid var(--line2)',
                  boxShadow: '0 12px 30px rgba(0,0,0,.35)',
                  background: 'var(--mapBg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }
              : mapMode === 'split'
                ? {
                     position: 'relative',
                     flexShrink: 0,
                     height: '360px',
                     overflow: 'hidden',
                     borderBottom: '1px solid var(--line)',
                     background: 'var(--mapBg)',
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                   }
                : {
                    position: 'relative',
                    flex: 1,
                    overflow: 'hidden',
                    background: 'var(--mapBg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }
          }
        >
          <MapArea
            mapMode={mapMode}
            maps={live?.maps ?? []}
            pins={live?.pins ?? {}}
            sceneMap={live?.sceneMap ?? {}}
            lastMapId={live?.ui.lastMapId ?? null}
            scenes={effectiveScenes}
            connections={effectiveConnections}
            currentSceneId={currentSceneId}
            visited={visited}
            revealed={revealed}
            connectionState={live?.connectionState ?? {}}
            soloMask={soloMask}
            scenesWithNotes={scenesWithNotes}
            onSelectScene={goToScene}
            onSetScenePin={setScenePin}
            onOpenMapLibrary={onOpenMapLibrary}
          />
        </div>
      )}

      {mapMode !== 'full' && (
        <div
          data-testid="zone-scene-stage"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '20px 24px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxSizing: 'border-box',
          }}
        >
          {!currentScene ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: '13px',
                        color: 'var(--accent)',
                        fontWeight: 600,
                      }}
                    >
                      scene-placeholder · #1
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '.08em',
                        textTransform: 'uppercase',
                        color: 'var(--violet)',
                        border: '1px solid var(--violetLine)',
                        borderRadius: '6px',
                        padding: '2px 6px',
                      }}
                    >
                      Physical Zone
                    </span>
                  </div>
                  <h1
                    style={{
                      margin: 0,
                      fontFamily: 'var(--head)',
                      fontSize: '30px',
                      fontWeight: 700,
                      letterSpacing: '-0.005em',
                      color: 'var(--text)',
                    }}
                  >
                    No Scene Loaded
                  </h1>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        background: 'var(--tagBg)',
                        color: 'var(--tagText)',
                        borderRadius: '6px',
                        padding: '3px 8px',
                      }}
                    >
                      App Shell Ready
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenPdf?.(1)}
                  style={{
                    height: '44px',
                    padding: '0 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--line)',
                    background: 'var(--p2)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Book p.1
                </button>
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>
                Import a module JSON in the act switcher sheet to view scenes.
              </p>
            </>
          ) : (
            <>
              {/* Scene header + Run Mode / Full Text toggle */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      data-testid="scene-header-code"
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: '13px',
                        color: 'var(--accent)',
                        fontWeight: 600,
                      }}
                    >
                      {currentScene.id} · #{currentScene.code}
                    </span>
                    <span
                      data-testid="scene-archetype-chip"
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '.08em',
                        textTransform: 'uppercase',
                        color: 'var(--violet)',
                        border: '1px solid var(--violetLine)',
                        borderRadius: '6px',
                        padding: '2px 6px',
                      }}
                    >
                      {labels.name}
                    </span>
                    <span
                      data-testid="scene-mode-badge"
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '.06em',
                        textTransform: 'uppercase',
                        color: sceneViewMode === 'run' ? 'var(--gold)' : 'var(--teal)',
                        background: sceneViewMode === 'run' ? 'var(--goldBg)' : 'var(--tealBg)',
                        border: `1px solid ${sceneViewMode === 'run' ? 'var(--goldLine)' : 'var(--tealLine)'}`,
                        borderRadius: '6px',
                        padding: '2px 6px',
                      }}
                    >
                      {sceneViewMode === 'run' ? 'Run Mode · 5s Scan' : 'Full Text · Expanded'}
                    </span>
                    {currentScene.needs_review && (
                      <span
                        data-testid="scene-needs-review-chip"
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--gold)',
                          border: '1px solid var(--goldLine)',
                          borderRadius: '6px',
                          padding: '2px 6px',
                        }}
                      >
                        Needs review
                      </span>
                    )}
                  </div>
                  <h1
                    data-testid="scene-title"
                    style={{
                      margin: 0,
                      fontFamily: 'var(--head)',
                      fontSize: '30px',
                      fontWeight: 700,
                      letterSpacing: '-0.005em',
                      color: 'var(--text)',
                    }}
                  >
                    {currentScene.title}
                  </h1>
                  {currentScene.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {currentScene.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            background: 'var(--tagBg)',
                            color: 'var(--tagText)',
                            borderRadius: '6px',
                            padding: '3px 8px',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <div
                    data-testid="scene-view-mode-toggle"
                    role="group"
                    aria-label="Scene view mode"
                    style={{
                      display: 'inline-flex',
                      background: 'var(--p2)',
                      border: '1px solid var(--line)',
                      borderRadius: '10px',
                      padding: '2px',
                      gap: '2px',
                    }}
                  >
                    <button
                      type="button"
                      data-testid="scene-mode-run"
                      aria-pressed={sceneViewMode === 'run'}
                      onClick={() => setSceneViewMode('run')}
                      style={{
                        height: '40px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        background: sceneViewMode === 'run' ? 'var(--accent)' : 'transparent',
                        color: sceneViewMode === 'run' ? 'var(--onAccent)' : 'var(--muted)',
                        cursor: 'pointer',
                      }}
                    >
                      Run Mode
                    </button>
                    <button
                      type="button"
                      data-testid="scene-mode-full"
                      aria-pressed={sceneViewMode === 'full'}
                      onClick={() => setSceneViewMode('full')}
                      style={{
                        height: '40px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        background: sceneViewMode === 'full' ? 'var(--accent)' : 'transparent',
                        color: sceneViewMode === 'full' ? 'var(--onAccent)' : 'var(--muted)',
                        cursor: 'pointer',
                      }}
                    >
                      Full Text
                    </button>
                  </div>

                  <button
                    type="button"
                    data-testid="scene-book-page-btn"
                    onClick={() => onOpenPdf?.(currentScene.page)}
                    style={{
                      height: '44px',
                      padding: '0 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--line)',
                      background: 'var(--p2)',
                      color: 'var(--text)',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Book p.{currentScene.page}
                  </button>

                  {typeof currentScene.encounter_page === 'number' && (
                    <button
                      type="button"
                      data-testid="scene-encounter-page-btn"
                      onClick={() => onOpenPdf?.(currentScene.encounter_page!)}
                      style={{
                        height: '44px',
                        padding: '0 14px',
                        borderRadius: '10px',
                        border: '1px solid var(--line)',
                        background: 'var(--p2)',
                        color: 'var(--text)',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      Encounter p.{currentScene.encounter_page}
                    </button>
                  )}
                </div>
              </div>

              {/* Table change banner (live notes on this scene, always above read-aloud) */}
              {sceneNotes.length > 0 && (
                <div
                  data-testid="table-change-banner"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {sceneNotes.map((note) => (
                    <button
                      key={note.id}
                      type="button"
                      data-testid={`table-note-${note.id}`}
                      onClick={() => onEditNote?.(note)}
                      style={{
                        background: 'var(--deltaBg)',
                        border: '1px solid var(--gold)',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'center',
                        minHeight: '44px',
                        width: '100%',
                        boxSizing: 'border-box',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--gold)',
                          flexShrink: 0,
                          alignSelf: 'flex-start',
                          paddingTop: '2px',
                        }}
                      >
                        TABLE CHANGE
                      </span>
                      <span
                        data-testid={`table-note-text-${note.id}`}
                        style={{
                          color: 'var(--deltaText)',
                          flex: 1,
                          fontSize: '14px',
                          whiteSpace: 'pre-line',
                        }}
                      >
                        {note.text}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Bird's-Eye Room Card: Summary + Read-aloud + Tier 1 Sensory */}
              <div
                data-testid="scene-birdseye-card"
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--line)',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                {currentScene.summary && (
                  <div
                    data-testid="scene-birdseye-summary"
                    style={{
                      fontSize: '14px',
                      color: 'var(--muted)',
                      lineHeight: 1.45,
                      borderBottom: '1px solid var(--line)',
                      paddingBottom: '10px',
                    }}
                  >
                    <strong style={{ color: 'var(--text)' }}>At a Glance:</strong>{' '}
                    {renderTextWithKeywords(currentScene.summary)}
                  </div>
                )}

                {/* Read-aloud card */}
                {currentScene.read_aloud !== null && (
                  <div
                    data-testid="read-aloud-card"
                    style={{
                      background: 'var(--p2)',
                      border: '1px solid var(--line)',
                      borderRadius: '12px',
                    }}
                  >
                    {typeof currentScene.read_aloud === 'string' ? (
                      <>
                        <button
                          type="button"
                          data-testid="read-aloud-fold-btn"
                          onClick={() => setReadOpen((o) => !o)}
                          aria-expanded={readOpen}
                          style={{
                            all: 'unset',
                            cursor: 'pointer',
                            display: 'flex',
                            width: '100%',
                            boxSizing: 'border-box',
                            alignItems: 'center',
                            padding: '10px 14px',
                            minHeight: '44px',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'var(--mono)',
                              fontSize: '11px',
                              letterSpacing: '.1em',
                              color: 'var(--muted)',
                              flex: 1,
                            }}
                          >
                            READ-ALOUD
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                            {readOpen ? 'Tap to fold' : 'Tap to open'}
                          </span>
                        </button>
                        {readOpen && (
                          <p
                            data-testid="read-aloud-text"
                            style={{
                              margin: 0,
                              padding: '0 14px 12px',
                              fontSize: '16px',
                              lineHeight: 1.55,
                              fontStyle: 'italic',
                              color: 'var(--readText)',
                            }}
                          >
                            {renderTextWithKeywords(currentScene.read_aloud)}
                          </p>
                        )}
                      </>
                    ) : (
                      <div
                        style={{
                          padding: '10px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--mono)',
                            fontSize: '11px',
                            letterSpacing: '.1em',
                            color: 'var(--muted)',
                          }}
                        >
                          READ-ALOUD
                        </span>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span
                            data-testid="read-aloud-pointer"
                            style={{
                              fontSize: '16px',
                              lineHeight: 1.55,
                              fontStyle: 'italic',
                              color: 'var(--readText)',
                              flex: 1,
                            }}
                          >
                            p.{currentScene.read_aloud.page} — starts: “{currentScene.read_aloud.starts_with}…”
                          </span>
                          <button
                            type="button"
                            data-testid="read-aloud-open-pdf-btn"
                            onClick={() => {
                              if (
                                currentScene.read_aloud &&
                                typeof currentScene.read_aloud === 'object'
                              ) {
                                onOpenPdf?.(currentScene.read_aloud.page);
                              }
                            }}
                            style={{
                              height: '44px',
                              padding: '0 14px',
                              borderRadius: '8px',
                              border: '1px solid var(--line)',
                              background: 'var(--p3)',
                              color: 'var(--text)',
                              fontSize: '13px',
                              fontWeight: 600,
                              flexShrink: 0,
                              cursor: 'pointer',
                            }}
                          >
                            Open in PDF
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tier 1 */}
                <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h2
                    data-testid="tier1-heading"
                    style={{
                      margin: 0,
                      fontFamily: 'var(--mono)',
                      fontSize: '12px',
                      letterSpacing: '.1em',
                      color: 'var(--muted)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    TIER 1 · {labels.tier1}
                  </h2>
                  {currentScene.tier1_sensory.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Nothing noted here.</div>
                  ) : (
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: '18px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        fontSize: '15px',
                        lineHeight: 1.5,
                        maxWidth: '68ch',
                      }}
                    >
                      {currentScene.tier1_sensory.map((line, idx) => (
                        <li key={idx}>{renderAnchoredLine(line)}</li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              {/* Inline NPC Stat Strips (moved from LeftPanel bottom split into Center Stage) */}
              <section
                data-testid="in-this-scene-dock"
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--line)',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: '12px',
                      letterSpacing: '.1em',
                      color: 'var(--muted)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    IN THIS SCENE · NPCS & THREATS
                  </span>
                  <span
                    className="gm-tabular"
                    style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted)' }}
                  >
                    {sceneEntityCards.length} active
                  </span>
                </div>

                {sceneEntityCards.length === 0 ? (
                  <div
                    data-testid="no-scene-entities"
                    style={{ fontSize: '13px', color: 'var(--muted)' }}
                  >
                    No one here. Yet.
                  </div>
                ) : (
                  sceneEntityCards.map((card) => {
                    const dispColor = DISPOSITION_COLORS[card.disposition];
                    const trackMatrix = entityTracks[card.id] ?? [];
                    const maxMatrix = entityTrackMax[card.id] ?? [];
                    const isDetailsOpen =
                      sceneViewMode === 'full' || Boolean(expandedEntities[card.id]);

                    return (
                      <div
                        key={card.id}
                        data-testid={`entity-card-${card.id}`}
                        style={{
                          background: 'var(--p2)',
                          border: '1px solid var(--line)',
                          borderRadius: '12px',
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        {/* Horizontal inline stat strip header */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <button
                            type="button"
                            data-testid={`inspect-entity-${card.id}`}
                            onClick={() => onOpenEntityInspector?.(card.id)}
                            style={{
                              all: 'unset',
                              cursor: 'pointer',
                              fontWeight: 700,
                              fontSize: '15px',
                              color: 'var(--text)',
                              minHeight: '36px',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                          >
                            {card.name}
                            {card.copyCount > 1 ? ` ×${card.copyCount}` : ''}
                          </button>

                          {card.statLine && (
                            <span
                              data-testid={`entity-inline-stats-${card.id}`}
                              className="gm-tabular"
                              style={{
                                fontFamily: 'var(--mono)',
                                fontSize: '12px',
                                color: 'var(--readText)',
                                background: 'var(--bg)',
                                border: '1px solid var(--line)',
                                borderRadius: '6px',
                                padding: '2px 8px',
                              }}
                            >
                              {card.statLine}
                            </span>
                          )}

                          {card.roleplay?.goal && (
                            <span
                              style={{
                                fontSize: '12px',
                                color: 'var(--muted)',
                                flex: 1,
                                minWidth: '120px',
                              }}
                            >
                              <strong style={{ color: 'var(--text)' }}>Want:</strong>{' '}
                              {card.roleplay.goal}
                            </span>
                          )}

                          {!card.roleplay?.goal && card.summary && (
                            <span
                              style={{
                                fontSize: '12px',
                                color: 'var(--muted)',
                                flex: 1,
                                minWidth: '120px',
                              }}
                            >
                              {card.summary}
                            </span>
                          )}

                          {card.isImprovised && (
                            <span
                              data-testid={`entity-improvised-chip-${card.id}`}
                              style={chipStyle('var(--gold)')}
                            >
                              Improvised
                            </span>
                          )}

                          <button
                            type="button"
                            data-testid={`entity-disp-chip-${card.id}`}
                            onClick={() =>
                              cycleEntityDisposition(card.id, card.defaultDisposition)
                            }
                            aria-label={`Change ${card.name} disposition (${card.disposition})`}
                            style={{
                              ...chipStyle(dispColor),
                              background: 'transparent',
                              cursor: 'pointer',
                            }}
                          >
                            {card.disposition}
                          </button>

                          {(card.roleplay || card.summary) && (
                            <button
                              type="button"
                              data-testid={`entity-details-toggle-${card.id}`}
                              aria-expanded={isDetailsOpen}
                              onClick={() =>
                                setExpandedEntities((prev) => ({
                                  ...prev,
                                  [card.id]: !prev[card.id],
                                }))
                              }
                              style={{
                                height: '32px',
                                padding: '0 8px',
                                borderRadius: '6px',
                                border: '1px solid var(--line)',
                                background: 'var(--p3)',
                                color: 'var(--muted)',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {isDetailsOpen ? 'Hide Roleplay ▴' : 'Roleplay ▾'}
                            </button>
                          )}

                          {card.isSummoned && currentSceneId && (
                            <button
                              type="button"
                              data-testid={`remove-summoned-${card.id}`}
                              onClick={() =>
                                removeSummonedEntityFromScene(currentSceneId, card.id)
                              }
                              aria-label={`Remove ${card.name} from scene`}
                              style={{
                                height: '32px',
                                padding: '0 8px',
                                borderRadius: '6px',
                                border: '1px solid var(--line2)',
                                background: 'var(--p3)',
                                color: 'var(--muted)',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        {/* Inline horizontal HP / Track steppers */}
                        {card.tracks.length > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '10px',
                              alignItems: 'center',
                            }}
                          >
                            {Array.from({ length: card.copyCount }).map((_, copyIdx) =>
                              card.tracks.map((trackDef, trackIdx) => {
                                const effectiveMax =
                                  maxMatrix[copyIdx]?.[trackIdx] ?? trackDef.max;
                                const currentVal =
                                  trackMatrix[copyIdx]?.[trackIdx] ?? effectiveMax;
                                const rowLabel =
                                  card.copyCount > 1
                                    ? `${trackDef.label} #${copyIdx + 1}`
                                    : trackDef.label;
                                return (
                                  <div
                                    key={`${copyIdx}-${trackIdx}`}
                                    data-testid={`entity-track-row-${card.id}-${copyIdx}-${trackIdx}`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      background: 'var(--panel)',
                                      border: '1px solid var(--line)',
                                      borderRadius: '10px',
                                      padding: '2px 6px 2px 10px',
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: '12px',
                                        color: 'var(--muted)',
                                        fontWeight: 600,
                                      }}
                                    >
                                      {rowLabel}
                                    </span>
                                    <button
                                      type="button"
                                      data-testid={`entity-track-dec-${card.id}-${copyIdx}-${trackIdx}`}
                                      aria-label={`Decrease ${card.name} ${rowLabel}`}
                                      onClick={() =>
                                        adjustEntityTrack(
                                          card.id,
                                          copyIdx,
                                          trackIdx,
                                          -1,
                                          card.copyCount,
                                          card.tracks
                                        )
                                      }
                                      style={{
                                        width: '44px',
                                        height: '44px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: 'var(--p3)',
                                        color: 'var(--text)',
                                        fontSize: '18px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      −
                                    </button>
                                    <span
                                      data-testid={`entity-track-val-${card.id}-${copyIdx}-${trackIdx}`}
                                      className="gm-tabular"
                                      style={{
                                        minWidth: '54px',
                                        textAlign: 'center',
                                        fontFamily: 'var(--mono)',
                                        fontWeight: 600,
                                      }}
                                    >
                                      {currentVal} / {effectiveMax}
                                    </span>
                                    <button
                                      type="button"
                                      data-testid={`entity-track-inc-${card.id}-${copyIdx}-${trackIdx}`}
                                      aria-label={`Increase ${card.name} ${rowLabel}`}
                                      onClick={() =>
                                        adjustEntityTrack(
                                          card.id,
                                          copyIdx,
                                          trackIdx,
                                          1,
                                          card.copyCount,
                                          card.tracks
                                        )
                                      }
                                      style={{
                                        width: '44px',
                                        height: '44px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: 'var(--p3)',
                                        color: 'var(--text)',
                                        fontSize: '18px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      +
                                    </button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}

                        {/* Collapsible Roleplay & Lore Accordion */}
                        <div
                          data-testid={`entity-details-accordion-${card.id}`}
                          className="gm-accordion"
                          data-open={isDetailsOpen ? 'true' : 'false'}
                          aria-hidden={!isDetailsOpen}
                        >
                          <div
                            className="gm-accordion-inner"
                            style={{ visibility: isDetailsOpen ? 'visible' : 'hidden' }}
                          >
                            {card.summary && (
                              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                {card.summary}
                              </div>
                            )}
                            {card.roleplay && (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '4px',
                                  fontSize: '12px',
                                  color: 'var(--readText)',
                                  borderTop: '1px solid var(--line)',
                                  paddingTop: '6px',
                                }}
                              >
                                {card.roleplay.voice && (
                                  <div>
                                    <strong style={{ color: 'var(--muted)' }}>VOICE:</strong>{' '}
                                    {card.roleplay.voice}
                                  </div>
                                )}
                                {card.roleplay.goal && (
                                  <div>
                                    <strong style={{ color: 'var(--muted)' }}>GOAL:</strong>{' '}
                                    {card.roleplay.goal}
                                  </div>
                                )}
                                {card.roleplay.secret && (
                                  <div data-testid={`entity-inline-secret-${card.id}`}>
                                    <strong style={{ color: 'var(--muted)' }}>SECRET:</strong>{' '}
                                    {soloMask ? 'Hidden in Solo Mode.' : card.roleplay.secret}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Roaming Threats Sub-bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                    borderTop: '1px solid var(--line)',
                    paddingTop: '8px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: '11px',
                      letterSpacing: '.1em',
                      color: 'var(--muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    ROAMING:
                  </span>
                  {roamingEntities.length === 0 ? (
                    <span
                      data-testid="no-roaming-entities"
                      style={{ fontSize: '12px', color: 'var(--muted)' }}
                    >
                      {merged.entities.some((e) => e.roaming)
                        ? 'All roaming threats are in this scene.'
                        : 'No roaming threats waiting.'}
                    </span>
                  ) : (
                    roamingEntities.map((roamer) => (
                      <div
                        key={roamer.id}
                        data-testid={`roaming-card-${roamer.id}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: 'var(--p2)',
                          border: '1px dashed var(--line2)',
                          borderRadius: '10px',
                          padding: '4px 6px 4px 10px',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => onOpenEntityInspector?.(roamer.id)}
                          style={{
                            all: 'unset',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 500,
                          }}
                        >
                          {roamer.name}
                        </button>
                        <button
                          type="button"
                          data-testid={`summon-btn-${roamer.id}`}
                          onClick={() => {
                            if (currentSceneId) {
                              summonEntityToScene(currentSceneId, roamer.id);
                            }
                          }}
                          style={{
                            height: '44px',
                            padding: '0 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--redLine)',
                            background: 'var(--redBg)',
                            color: 'var(--red)',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Summon
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Tier 2 */}
              <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h2
                  data-testid="tier2-heading"
                  style={{
                    margin: 0,
                    fontFamily: 'var(--mono)',
                    fontSize: '12px',
                    letterSpacing: '.1em',
                    color: 'var(--muted)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  TIER 2 · {labels.tier2}
                </h2>
                {currentScene.tier2_interactive.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                    Nothing interactive here.
                  </div>
                ) : (
                  currentScene.tier2_interactive.map((item) => {
                    const view = getMaskedItemView(item, 2, soloMask, revealed);
                    const isItemExpanded =
                      sceneViewMode === 'full' ||
                      view.isRevealed ||
                      Boolean(expandedItems[item.id]);

                    return (
                      <div
                        key={item.id}
                        data-testid={`item-card-${item.id}`}
                        style={{
                          background: 'var(--panel)',
                          border: '1px solid var(--line)',
                          borderRadius: '12px',
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={chipStyle(KIND_COLOR_VARS[view.kind])}>
                            {view.kindLabel}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: '15px', flex: 1 }}>
                            {renderTextWithKeywords(view.label)}
                          </span>
                          {view.showResult && (
                            <button
                              type="button"
                              data-testid={`item-expand-btn-${item.id}`}
                              aria-expanded={isItemExpanded}
                              onClick={() =>
                                setExpandedItems((prev) => ({
                                  ...prev,
                                  [item.id]: !isItemExpanded,
                                }))
                              }
                              style={{
                                height: '36px',
                                padding: '0 10px',
                                borderRadius: '8px',
                                border: '1px solid var(--line)',
                                background: 'var(--p2)',
                                color: 'var(--muted)',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {isItemExpanded ? 'Hide ▴' : 'Details ▾'}
                            </button>
                          )}
                          <button
                            type="button"
                            data-testid={`reveal-btn-${item.id}`}
                            className={flashedIds[item.id] ? 'gm-flash-confirm' : undefined}
                            onClick={() => {
                              if (!view.isRevealed) {
                                triggerFlash(item.id);
                                setExpandedItems((prev) => ({ ...prev, [item.id]: true }));
                              }
                              toggleRevealedItem(item.id, item.unlocks_connection_id);
                            }}
                            style={actionBtnStyle(view.isRevealed)}
                          >
                            {flashedIds[item.id] && view.isRevealed
                              ? `${view.actionButtonLabel} ✓`
                              : view.actionButtonLabel}
                          </button>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div
                            style={{
                              fontFamily: 'var(--mono)',
                              fontSize: '13px',
                              color: 'var(--blue)',
                            }}
                          >
                            <strong style={{ fontWeight: 700 }}>Check</strong> {view.checkText}
                          </div>
                          {item.truth_id && truthById.has(item.truth_id) && (
                            <button
                              type="button"
                              data-testid={`truth-link-${item.id}`}
                              onClick={() =>
                                setActivePeek({ kind: 'truth', targetId: item.truth_id! })
                              }
                              style={{
                                height: '28px',
                                padding: '0 8px',
                                borderRadius: '6px',
                                border: '1px solid var(--tealLine)',
                                background: 'var(--tealBg)',
                                color: 'var(--teal)',
                                fontFamily: 'var(--mono)',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Truth: {truthById.get(item.truth_id)!.title}
                            </button>
                          )}
                        </div>
                        {view.showResult && isItemExpanded && (
                          <div
                            data-testid={`item-result-${item.id}`}
                            style={{ fontSize: '14px', color: 'var(--readText)', maxWidth: '68ch' }}
                          >
                            {renderTextWithKeywords(view.resultText)}
                          </div>
                        )}
                        {view.showHiddenResultHint && (
                          <div
                            data-testid={`item-hidden-hint-${item.id}`}
                            style={{ fontSize: '13px', color: 'var(--muted)' }}
                          >
                            Result hidden. Roll, then tap Reveal.
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </section>

              {/* Tier 3 */}
              <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h2
                  data-testid="tier3-heading"
                  style={{
                    margin: 0,
                    fontFamily: 'var(--mono)',
                    fontSize: '12px',
                    letterSpacing: '.1em',
                    color: 'var(--muted)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  TIER 3 · {labels.tier3}
                </h2>
                {currentScene.tier3_hidden.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                    Nothing hidden here.
                  </div>
                ) : (
                  currentScene.tier3_hidden.map((item) => {
                    const view = getMaskedItemView(item, 3, soloMask, revealed);
                    const isItemExpanded =
                      sceneViewMode === 'full' ||
                      view.isRevealed ||
                      Boolean(expandedItems[item.id]);

                    return (
                      <div
                        key={item.id}
                        data-testid={`item-card-${item.id}`}
                        style={{
                          borderRadius: '12px',
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          background: view.isCardMasked
                            ? 'repeating-linear-gradient(135deg, var(--panel) 0 10px, var(--stripe) 10px 20px)'
                            : 'var(--panel)',
                          border: view.isCardMasked
                            ? '1px dashed var(--line2)'
                            : '1px solid var(--line)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={chipStyle(KIND_COLOR_VARS[view.kind])}>
                            {view.kindLabel}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: '15px', flex: 1 }}>
                            {view.isCardMasked
                              ? view.label
                              : renderTextWithKeywords(view.label)}
                          </span>
                          {view.showResult && (
                            <button
                              type="button"
                              data-testid={`item-expand-btn-${item.id}`}
                              aria-expanded={isItemExpanded}
                              onClick={() =>
                                setExpandedItems((prev) => ({
                                  ...prev,
                                  [item.id]: !isItemExpanded,
                                }))
                              }
                              style={{
                                height: '36px',
                                padding: '0 10px',
                                borderRadius: '8px',
                                border: '1px solid var(--line)',
                                background: 'var(--p2)',
                                color: 'var(--muted)',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {isItemExpanded ? 'Hide ▴' : 'Details ▾'}
                            </button>
                          )}
                          <button
                            type="button"
                            data-testid={`reveal-btn-${item.id}`}
                            className={flashedIds[item.id] ? 'gm-flash-confirm' : undefined}
                            onClick={() => {
                              if (!view.isRevealed) {
                                triggerFlash(item.id);
                                setExpandedItems((prev) => ({ ...prev, [item.id]: true }));
                              }
                              toggleRevealedItem(item.id, item.unlocks_connection_id);
                            }}
                            style={actionBtnStyle(view.isRevealed)}
                          >
                            {flashedIds[item.id] && view.isRevealed
                              ? `${view.actionButtonLabel} ✓`
                              : view.actionButtonLabel}
                          </button>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div
                            style={{
                              fontFamily: 'var(--mono)',
                              fontSize: '13px',
                              color: 'var(--blue)',
                            }}
                          >
                            <strong style={{ fontWeight: 700 }}>Check</strong> {view.checkText}
                          </div>
                          {!view.isCardMasked &&
                            item.truth_id &&
                            truthById.has(item.truth_id) && (
                              <button
                                type="button"
                                data-testid={`truth-link-${item.id}`}
                                onClick={() =>
                                  setActivePeek({ kind: 'truth', targetId: item.truth_id! })
                                }
                                style={{
                                  height: '28px',
                                  padding: '0 8px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--tealLine)',
                                  background: 'var(--tealBg)',
                                  color: 'var(--teal)',
                                  fontFamily: 'var(--mono)',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Truth: {truthById.get(item.truth_id)!.title}
                              </button>
                            )}
                        </div>
                        {view.showResult && isItemExpanded && (
                          <div
                            data-testid={`item-result-${item.id}`}
                            style={{ fontSize: '14px', color: 'var(--readText)', maxWidth: '68ch' }}
                          >
                            {renderTextWithKeywords(view.resultText)}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </section>

              {/* Escalation */}
              {currentScene.escalation.length > 0 && (
                <section
                  data-testid="scene-escalation-section"
                  style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontFamily: 'var(--mono)',
                      fontSize: '12px',
                      letterSpacing: '.1em',
                      color: 'var(--muted)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    ESCALATION
                  </h2>
                  {currentScene.escalation.map((esc, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        gap: '12px',
                        padding: '8px 12px',
                        background: 'var(--escBg)',
                        border: '1px solid var(--redLine)',
                        borderRadius: '10px',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: '12px',
                          color: 'var(--red)',
                          width: '64px',
                          flexShrink: 0,
                          fontWeight: 600,
                        }}
                      >
                        {esc.at}
                      </span>
                      <span style={{ fontSize: '14px' }}>
                        {renderTextWithKeywords(esc.text)}
                      </span>
                    </div>
                  ))}
                </section>
              )}

              {/* GM tip */}
              {currentScene.gm_tips && (
                <div
                  data-testid="scene-gm-tip"
                  style={{
                    background: 'var(--panel)',
                    border: '1px dashed var(--line2)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    color: 'var(--muted)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: '11px',
                      letterSpacing: '.1em',
                      fontWeight: 600,
                      marginRight: '8px',
                    }}
                  >
                    GM TIP:
                  </span>
                  {renderTextWithKeywords(currentScene.gm_tips)}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <ExitsBar />
    </main>
  );
};
