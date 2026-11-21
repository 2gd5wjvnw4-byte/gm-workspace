import React, { useMemo, useState } from 'react';
import {
  getEffectiveClocks,
  getEffectiveFactions,
  getEffectiveScenes,
  getEffectiveTruths,
} from '../lib/improvised';
import type { DeskCardRecord, DeskLinkOpenMode } from '../storage/types';
import { useCampaignStore } from '../store/campaignStore';
import { AddRightItemModal, type AddRightItemMode } from './AddRightItemModal';
import {
  ClocksSection,
  ClueMatrixSection,
  FactionsSection,
  RandomTablesSection,
  TimelineSection,
} from './RightPanelSections';

export interface DeskRightSectionCardBodyProps {
  card: DeskCardRecord;
  linkOpenMode: DeskLinkOpenMode;
  onSpawnSceneCard: (sceneId: string, nearCard: DeskCardRecord) => void;
  onSpawnSheetCard: (entityId: string, nearCard: DeskCardRecord) => void;
  onOpenEntityInspector?: (entityId: string) => void;
}

export const DeskRightSectionCardBody: React.FC<DeskRightSectionCardBodyProps> = ({
  card,
  linkOpenMode,
  onSpawnSceneCard,
  onSpawnSheetCard,
  onOpenEntityInspector,
}) => {
  const {
    merged,
    live,
    goToScene,
    toggleRevealedItem,
    adjustClockValue,
    toggleTimelineDone,
    cycleFactionAttitude,
    appendRollLog,
    summonEntityToScene,
    addTableNote,
    addImprovisedClock,
    addImprovisedClue,
    addImprovisedFaction,
  } = useCampaignStore();

  const [addModal, setAddModal] = useState<{ open: boolean; mode: AddRightItemMode }>({
    open: false,
    mode: 'clock',
  });

  const soloMask = Boolean(live?.ui?.soloMask);
  const effectiveScenes = useMemo(
    () => getEffectiveScenes(merged.scenes, live),
    [merged.scenes, live]
  );
  const currentSceneId = live?.currentSceneId ?? effectiveScenes[0]?.id ?? null;
  const currentScene = useMemo(
    () => effectiveScenes.find((s) => s.id === currentSceneId) ?? null,
    [effectiveScenes, currentSceneId]
  );
  const currentActId = currentScene?.act_id ?? merged.acts[0]?.id ?? null;

  const effectiveClocks = useMemo(
    () => getEffectiveClocks(merged.clocks, live),
    [merged.clocks, live]
  );
  const effectiveTruths = useMemo(
    () => getEffectiveTruths(merged.truths, live),
    [merged.truths, live]
  );
  const effectiveFactions = useMemo(
    () => getEffectiveFactions(merged.factions, live),
    [merged.factions, live]
  );

  const sceneTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of effectiveScenes) {
      map.set(s.id, s.title);
    }
    return map;
  }, [effectiveScenes]);

  const dayTracker = useMemo(
    () => merged.trackers.find((t) => t.label.trim().toLowerCase() === 'day') ?? null,
    [merged.trackers]
  );
  const currentDayValue = dayTracker
    ? (live?.trackerValues?.[dayTracker.id] ?? dayTracker.start)
    : null;

  const handleJumpScene = (sceneId: string) => {
    if (linkOpenMode === 'new-card') {
      onSpawnSceneCard(sceneId, card);
    } else {
      goToScene(sceneId);
    }
  };

  const handleOpenEntity = (entityId: string) => {
    if (linkOpenMode === 'new-card') {
      onSpawnSheetCard(entityId, card);
    } else {
      onOpenEntityInspector?.(entityId);
    }
  };

  return (
    <div data-testid={`desk-tool-body-${card.type}-${card.id}`}>
      {card.type === 'clocks' && (
        <ClocksSection
          clocks={effectiveClocks}
          clockValues={live?.clockValues ?? {}}
          currentActId={currentActId}
          soloMask={soloMask}
          open={true}
          onAdjustClock={adjustClockValue}
          onOpenAddClock={() => setAddModal({ open: true, mode: 'clock' })}
        />
      )}

      {card.type === 'timeline' && (
        <TimelineSection
          timeline={merged.timeline}
          timelineDone={live?.timelineDone ?? {}}
          revealed={live?.revealed ?? {}}
          currentDayValue={currentDayValue}
          soloMask={soloMask}
          sceneTitleById={sceneTitleById}
          open={true}
          onToggleDone={toggleTimelineDone}
          onToggleReveal={(id) => toggleRevealedItem(id)}
          onJumpToScene={handleJumpScene}
        />
      )}

      {card.type === 'clue-matrix' && (
        <ClueMatrixSection
          truths={effectiveTruths}
          scenes={effectiveScenes}
          entities={merged.entities}
          improvisedClues={live?.improvisedClues ?? []}
          revealed={live?.revealed ?? {}}
          soloMask={soloMask}
          open={true}
          onJumpToScene={handleJumpScene}
          onOpenEntityInspector={handleOpenEntity}
          onToggleClueRevealed={(id) => toggleRevealedItem(id)}
          onOpenAddClue={() => setAddModal({ open: true, mode: 'clue' })}
        />
      )}

      {card.type === 'factions' && (
        <FactionsSection
          factions={effectiveFactions}
          factionAttitude={live?.factionAttitude ?? {}}
          soloMask={soloMask}
          open={true}
          onCycleAttitude={cycleFactionAttitude}
          onOpenAddFaction={() => setAddModal({ open: true, mode: 'faction' })}
        />
      )}

      {card.type === 'random-tables' && (
        <RandomTablesSection
          tables={merged.random_tables}
          rollLog={live?.rollLog ?? []}
          currentSceneId={currentSceneId}
          open={true}
          onAppendRollLog={appendRollLog}
          onSummonEntity={summonEntityToScene}
          onAddSceneNote={(sceneId, text) => addTableNote(sceneId, text)}
        />
      )}

      <AddRightItemModal
        open={addModal.open}
        mode={addModal.mode}
        truths={effectiveTruths}
        currentActId={currentActId}
        currentSceneId={currentSceneId}
        currentSceneTitle={currentScene?.title ?? null}
        onClose={() => setAddModal((prev) => ({ ...prev, open: false }))}
        onAddClock={(input) => {
          addImprovisedClock(input);
        }}
        onAddClue={(input) => {
          addImprovisedClue(input);
        }}
        onAddFaction={(input) => {
          addImprovisedFaction(input);
        }}
      />
    </div>
  );
};
