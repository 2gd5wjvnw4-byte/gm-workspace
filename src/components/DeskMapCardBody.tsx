import React from 'react';
import type { DeskCardRecord, MapAssetRecord } from '../storage/types';
import { useBlobObjectUrl } from './MapLibrarySheet';

export interface DeskMapCardBodyProps {
  card: DeskCardRecord;
  maps: MapAssetRecord[];
  onSelectMap: (mapId: string, title: string) => void;
}

export const DeskMapCardBody: React.FC<DeskMapCardBodyProps> = ({
  card,
  maps,
  onSelectMap,
}) => {
  const selectedMap = card.targetId
    ? maps.find((m) => m.id === card.targetId) ?? null
    : maps[0] ?? null;

  const imageUrl = useBlobObjectUrl(selectedMap?.blobKey);

  if (maps.length === 0 || !selectedMap) {
    return (
      <div
        data-testid={`desk-map-card-empty-${card.id}`}
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
        No maps in library yet. Crop a map from the PDF or upload one in Map Library.
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        {maps.length > 1 ? (
          <select
            data-testid={`desk-map-card-select-${card.id}`}
            aria-label="Select map"
            value={selectedMap.id}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const nextMap = maps.find((m) => m.id === e.target.value);
              if (nextMap) {
                onSelectMap(nextMap.id, nextMap.name);
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
            {maps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        ) : (
          <div
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {selectedMap.name}
          </div>
        )}
        {selectedMap.scale && (
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '3px 7px',
              borderRadius: '6px',
              background: 'var(--p2)',
              border: '1px solid var(--line)',
              color: 'var(--muted)',
              flexShrink: 0,
            }}
          >
            {selectedMap.scale}
          </span>
        )}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: '100px',
          borderRadius: '8px',
          border: '1px solid var(--line)',
          background: 'var(--mapBg)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {imageUrl ? (
          <img
            data-testid={`desk-map-card-img-${card.id}`}
            src={imageUrl}
            alt={selectedMap.name}
            draggable={false}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        ) : (
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Loading map…
          </span>
        )}
      </div>
    </div>
  );
};
