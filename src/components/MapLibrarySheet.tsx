import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getEffectiveScenes } from '../lib/improvised';
import { getBlob, type MapAssetRecord, type MapScale } from '../storage';
import { useCampaignStore } from '../store/campaignStore';

export interface MapLibrarySheetProps {
  open: boolean;
  onClose: () => void;
}

const SCALE_OPTIONS: Array<{ value: MapScale | ''; label: string }> = [
  { value: '', label: 'No scale' },
  { value: 'Tactical', label: 'Tactical' },
  { value: 'District', label: 'District' },
  { value: 'Regional', label: 'Regional' },
  { value: 'Relationship', label: 'Relationship' },
];

async function readImageDimensions(
  file: Blob
): Promise<{ width: number; height: number }> {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function' || typeof Image === 'undefined') {
    return { width: 800, height: 600 };
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      const timer = window.setTimeout(() => {
        resolve({ width: 800, height: 600 });
      }, 1500);
      img.onload = () => {
        window.clearTimeout(timer);
        resolve({
          width: img.naturalWidth || 800,
          height: img.naturalHeight || 600,
        });
      };
      img.onerror = () => {
        window.clearTimeout(timer);
        resolve({ width: 800, height: 600 });
      };
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function useBlobObjectUrl(blobKey: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blobKey) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      const record = await getBlob(blobKey);
      if (cancelled || !record) {
        if (!cancelled) setUrl(null);
        return;
      }
      if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        return;
      }
      let blob: Blob;
      if (record.data instanceof Blob) {
        blob = record.data;
      } else if (record.data instanceof Uint8Array) {
        const copy = new Uint8Array(record.data.byteLength);
        copy.set(record.data);
        blob = new Blob([copy.buffer], { type: record.mimeType || 'image/png' });
      } else {
        blob = new Blob([String(record.data)], { type: record.mimeType || 'image/png' });
      }
      objectUrl = URL.createObjectURL(blob);
      if (!cancelled) {
        setUrl(objectUrl);
      } else {
        URL.revokeObjectURL(objectUrl);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [blobKey]);

  return url;
}

const MapThumbnail: React.FC<{ map: MapAssetRecord }> = ({ map }) => {
  const url = useBlobObjectUrl(map.blobKey);
  if (!url) {
    return (
      <div
        style={{
          width: '88px',
          height: '66px',
          borderRadius: '8px',
          background: 'var(--mapBg)',
          border: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          fontFamily: 'var(--mono)',
          color: 'var(--muted)',
          flexShrink: 0,
        }}
      >
        {map.width}×{map.height}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={map.name}
      style={{
        width: '88px',
        height: '66px',
        objectFit: 'cover',
        borderRadius: '8px',
        border: '1px solid var(--line)',
        background: 'var(--mapBg)',
        flexShrink: 0,
      }}
    />
  );
};

export const MapLibrarySheet: React.FC<MapLibrarySheetProps> = ({ open, onClose }) => {
  const {
    merged,
    live,
    addMapAsset,
    updateMapAsset,
    deleteMapAsset,
    setSceneMap,
    setLastMapId,
  } = useCampaignStore();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [assigningMapId, setAssigningMapId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const scenes = useMemo(() => getEffectiveScenes(merged.scenes, live), [merged.scenes, live]);
  const maps = live?.maps ?? [];
  const sceneMap = live?.sceneMap ?? {};
  const currentSceneId = live?.currentSceneId ?? null;
  const lastMapId = live?.ui.lastMapId ?? null;

  if (!open) return null;

  const handleUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMessage(null);
    try {
      const dims = await readImageDimensions(file);
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'Uploaded Map';
      const created = await addMapAsset({
        name: baseName,
        data: file,
        mimeType: file.type || 'image/png',
        width: dims.width,
        height: dims.height,
        fileName: file.name,
      });
      if (created) {
        setStatusMessage(`Added "${created.name}".`);
      }
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Failed to upload map.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div
      data-testid="map-library-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 45,
        background: 'rgba(0,0,0,0.62)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Map Library"
        data-testid="map-library-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '86vh',
          background: 'var(--panel)',
          border: '1px solid var(--line2)',
          borderRadius: '14px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '14px 16px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--p2)',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--muted)',
              }}
            >
              Map Library
            </div>
            <div style={{ fontFamily: 'var(--head)', fontSize: '20px', fontWeight: 700 }}>
              Campaign Maps ({maps.length})
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              data-testid="map-upload-input"
              onChange={(e) => void handleUploadChange(e)}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              data-testid="map-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              style={{
                height: '44px',
                padding: '0 14px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--accent)',
                color: 'var(--onAccent)',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Upload Map
            </button>
            <button
              type="button"
              data-testid="map-library-close-btn"
              onClick={onClose}
              style={{
                height: '44px',
                padding: '0 14px',
                borderRadius: '10px',
                border: '1px solid var(--line)',
                background: 'var(--p3)',
                color: 'var(--text)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {statusMessage && (
            <div
              data-testid="map-library-status"
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'var(--tealBg)',
                border: '1px solid var(--tealLine)',
                color: 'var(--teal)',
                fontSize: '13px',
              }}
            >
              {statusMessage}
            </div>
          )}

          {maps.length === 0 ? (
            <div
              data-testid="map-library-empty"
              style={{
                padding: '24px 16px',
                borderRadius: '12px',
                border: '1px dashed var(--line2)',
                background: 'var(--p2)',
                color: 'var(--muted)',
                fontSize: '14px',
                textAlign: 'center',
              }}
            >
              No maps yet. Upload a PNG/JPG/WebP image or crop a page from the PDF drawer.
            </div>
          ) : (
            maps.map((map) => {
              const titleValue = titleDrafts[map.id] ?? map.name;
              const assignedSceneIds = scenes
                .filter((s) => sceneMap[s.id] === map.id)
                .map((s) => s.id);
              const isAssignOpen = assigningMapId === map.id;
              const isConfirmDelete = confirmDeleteId === map.id;
              const isLastUsed = lastMapId === map.id;

              return (
                <div
                  key={map.id}
                  data-testid={`map-library-item-${map.id}`}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    background: 'var(--p2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <MapThumbnail map={map} />
                    <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          aria-label={`Map title for ${map.name}`}
                          data-testid={`map-title-input-${map.id}`}
                          value={titleValue}
                          onChange={(e) =>
                            setTitleDrafts((prev) => ({ ...prev, [map.id]: e.target.value }))
                          }
                          onBlur={() => {
                            const trimmed = titleValue.trim();
                            if (trimmed && trimmed !== map.name) {
                              updateMapAsset(map.id, { name: trimmed });
                            }
                          }}
                          style={{
                            flex: 1,
                            minWidth: '140px',
                            height: '40px',
                            padding: '0 10px',
                            borderRadius: '8px',
                            border: '1px solid var(--line)',
                            background: 'var(--bg)',
                            color: 'var(--text)',
                            fontSize: '14px',
                            fontWeight: 600,
                          }}
                        />
                        <select
                          aria-label={`Scale tag for ${map.name}`}
                          data-testid={`map-scale-select-${map.id}`}
                          value={map.scale ?? ''}
                          onChange={(e) => {
                            const val = e.target.value as MapScale | '';
                            updateMapAsset(map.id, { scale: val || undefined });
                          }}
                          style={{
                            height: '40px',
                            padding: '0 10px',
                            borderRadius: '8px',
                            border: '1px solid var(--line)',
                            background: 'var(--bg)',
                            color: 'var(--text)',
                            fontSize: '13px',
                          }}
                        >
                          {SCALE_OPTIONS.map((opt) => (
                            <option key={opt.label} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={{ fontSize: '12px', fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
                        {map.width}×{map.height} px · {assignedSceneIds.length} scene
                        {assignedSceneIds.length === 1 ? '' : 's'} assigned
                        {isLastUsed ? ' · Active fallback' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      data-testid={`map-use-btn-${map.id}`}
                      onClick={() => {
                        setLastMapId(map.id);
                        setStatusMessage(`"${map.name}" selected as active map.`);
                      }}
                      style={{
                        height: '40px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        border: isLastUsed ? '1px solid var(--accent)' : '1px solid var(--line)',
                        background: isLastUsed ? 'var(--accentBg)' : 'var(--p3)',
                        color: isLastUsed ? 'var(--accent)' : 'var(--text)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {isLastUsed ? 'Active map' : 'Use map'}
                    </button>

                    {currentSceneId && (
                      <button
                        type="button"
                        data-testid={`map-set-current-scene-btn-${map.id}`}
                        onClick={() => {
                          const already = sceneMap[currentSceneId] === map.id;
                          setSceneMap([currentSceneId], already ? null : map.id);
                        }}
                        style={{
                          height: '40px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          border:
                            sceneMap[currentSceneId] === map.id
                              ? '1px solid var(--tealLine)'
                              : '1px solid var(--line)',
                          background:
                            sceneMap[currentSceneId] === map.id ? 'var(--tealBg)' : 'var(--p3)',
                          color:
                            sceneMap[currentSceneId] === map.id ? 'var(--teal)' : 'var(--text)',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {sceneMap[currentSceneId] === map.id
                          ? 'Default for current scene ✓'
                          : 'Set for current scene'}
                      </button>
                    )}

                    <button
                      type="button"
                      data-testid={`map-assign-scenes-btn-${map.id}`}
                      onClick={() => setAssigningMapId(isAssignOpen ? null : map.id)}
                      style={{
                        height: '40px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--line)',
                        background: 'var(--p3)',
                        color: 'var(--text)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {isAssignOpen ? 'Hide scenes' : `Assign scenes (${assignedSceneIds.length})`}
                    </button>

                    {!isConfirmDelete ? (
                      <button
                        type="button"
                        data-testid={`map-delete-btn-${map.id}`}
                        onClick={() => setConfirmDeleteId(map.id)}
                        style={{
                          marginLeft: 'auto',
                          height: '40px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--redLine)',
                          background: 'var(--escBg)',
                          color: 'var(--red)',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    ) : (
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          data-testid={`map-delete-confirm-btn-${map.id}`}
                          onClick={() => {
                            void deleteMapAsset(map.id);
                            setConfirmDeleteId(null);
                          }}
                          style={{
                            height: '40px',
                            padding: '0 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'var(--red)',
                            color: '#fff',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Confirm delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          style={{
                            height: '40px',
                            padding: '0 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--line)',
                            background: 'var(--p3)',
                            color: 'var(--text)',
                            fontSize: '13px',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Scene assignment list */}
                  {isAssignOpen && (
                    <div
                      data-testid={`map-scene-picker-${map.id}`}
                      style={{
                        padding: '10px',
                        borderRadius: '10px',
                        background: 'var(--bg)',
                        border: '1px solid var(--line)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        maxHeight: '220px',
                        overflowY: 'auto',
                      }}
                    >
                      {scenes.map((scene) => {
                        const checked = sceneMap[scene.id] === map.id;
                        return (
                          <label
                            key={scene.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              minHeight: '36px',
                              cursor: 'pointer',
                              fontSize: '13px',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setSceneMap([scene.id], e.target.checked ? map.id : null)
                              }
                            />
                            <span style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
                              {scene.code}
                            </span>
                            <span>{scene.title}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
