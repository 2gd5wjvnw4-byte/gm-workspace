import React from 'react';
import type { DeskCardRecord } from '../storage/types';
import { useCampaignStore } from '../store/campaignStore';
import { EntitySheetContent } from './EntitySheetContent';

export interface DeskSheetCardBodyProps {
  card: DeskCardRecord;
  onSelectEntity: (entityId: string, title: string) => void;
  onOpenPdfPage?: (printedPage: number) => void;
}

export const DeskSheetCardBody: React.FC<DeskSheetCardBodyProps> = ({
  card,
  onSelectEntity,
  onOpenPdfPage,
}) => {
  const { merged, live } = useCampaignStore();
  const improvised = live?.improvisedEntities ?? [];

  const allOptions = [
    ...merged.entities.map((e) => ({
      id: e.id,
      label: `${e.name} (${e.type})`,
      name: e.name,
    })),
    ...improvised.map((e) => ({
      id: e.id,
      label: `${e.name} (Improvised)`,
      name: e.name,
    })),
  ];

  const resolvedEntityId =
    card.targetId && allOptions.some((o) => o.id === card.targetId)
      ? card.targetId
      : allOptions[0]?.id ?? null;

  return (
    <div
      data-testid={`desk-sheet-card-body-${card.id}`}
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {allOptions.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <select
            data-testid={`desk-sheet-select-${card.id}`}
            aria-label="Select NPC or character sheet"
            value={resolvedEntityId ?? ''}
            onChange={(e) => {
              const found = allOptions.find((o) => o.id === e.target.value);
              if (found) {
                onSelectEntity(found.id, found.name);
              }
            }}
            style={{
              flex: 1,
              minWidth: 0,
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
            {allOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {resolvedEntityId ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '8px',
            border: '1px solid var(--line)',
            background: 'var(--panel)',
            overflow: 'hidden',
          }}
        >
          <EntitySheetContent
            entityId={resolvedEntityId}
            onOpenPdfPage={onOpenPdfPage}
            testIdPrefix={`desk-sheet-${card.id}`}
          />
        </div>
      ) : (
        <div
          data-testid={`desk-sheet-empty-${card.id}`}
          style={{
            flex: 1,
            minHeight: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '16px',
            borderRadius: '8px',
            border: '1px dashed var(--line2)',
            background: 'var(--mapBg)',
            color: 'var(--muted)',
            fontSize: '13px',
            lineHeight: 1.45,
          }}
        >
          No NPCs loaded yet. Import a module or add an improvised NPC. Player character sheets arrive in Stage 8c.
        </div>
      )}
    </div>
  );
};
