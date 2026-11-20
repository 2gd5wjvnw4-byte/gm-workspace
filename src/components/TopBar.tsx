import React, { useRef, useState } from 'react';
import type { MapDisplayMode } from '../storage/types';
import { getEffectiveConnections, getEffectiveScenes } from '../lib/improvised';
import {
  searchModuleRecords,
  type SearchResultEntry,
  type SearchResultType,
} from '../lib/solo';
import { useCampaignStore } from '../store/campaignStore';

export interface TopBarProps {
  campaignLabel?: string;
  reviewCount?: number;
  onOpenActSwitcher?: () => void;
  onOpenReview?: () => void;
  mapMode: MapDisplayMode;
  onSelectMapMode: (mode: MapDisplayMode) => void;
  soloMask: boolean;
  onToggleSoloMask: () => void;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
  deskMode?: boolean;
  onToggleDeskMode?: () => void;
  onOpenPdf: () => void;
  onOpenEntityInspector?: (entityId: string) => void;
  onOpenMapLibrary?: () => void;
}

const MAP_MODES: Array<{ id: MapDisplayMode; label: string }> = [
  { id: 'off', label: 'Text' },
  { id: 'pip', label: 'PiP' },
  { id: 'split', label: 'Split' },
  { id: 'full', label: 'Map' },
];

const SEARCH_TYPE_ORDER: SearchResultType[] = [
  'scene',
  'entity',
  'item',
  'truth',
  'faction',
  'table',
];

const SEARCH_TYPE_HEADINGS: Record<SearchResultType, string> = {
  scene: 'Scenes',
  entity: 'Entities',
  item: 'Scene Items',
  truth: 'Truths',
  faction: 'Factions',
  table: 'Random Tables',
};

export const TopBar: React.FC<TopBarProps> = ({
  campaignLabel = 'TopBar · No module loaded',
  reviewCount = 0,
  onOpenActSwitcher,
  onOpenReview,
  mapMode,
  onSelectMapMode,
  soloMask,
  onToggleSoloMask,
  focusMode = true,
  onToggleFocusMode,
  deskMode = false,
  onToggleDeskMode,
  onOpenPdf,
  onOpenEntityInspector,
  onOpenMapLibrary,
}) => {
  const { merged, live, adjustTrackerValue, goToScene } = useCampaignStore();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const mapLongPressTimerRef = useRef<number | null>(null);
  const mapLongPressFiredRef = useRef(false);

  const clearMapLongPress = () => {
    if (mapLongPressTimerRef.current !== null) {
      window.clearTimeout(mapLongPressTimerRef.current);
      mapLongPressTimerRef.current = null;
    }
  };

  const effectiveScenes = getEffectiveScenes(merged.scenes, live);
  const effectiveConnections = getEffectiveConnections(merged.connections, live);
  const currentSceneId = live?.currentSceneId ?? effectiveScenes[0]?.id ?? null;
  const currentScene =
    effectiveScenes.find((s) => s.id === currentSceneId) ?? effectiveScenes[0] ?? null;
  const currentActId =
    currentScene?.act_id ?? merged.acts[0]?.id ?? null;

  const scopedTrackers = merged.trackers.filter(
    (t) =>
      !t.scope ||
      t.scope.toLowerCase() === 'global' ||
      (currentActId && t.scope === currentActId)
  );
  const trackerValues = live?.trackerValues ?? {};

  const searchResults = searchModuleRecords({
    query: searchQuery,
    scenes: effectiveScenes,
    entities: merged.entities,
    improvisedEntities: live?.improvisedEntities ?? [],
    truths: merged.truths,
    factions: merged.factions,
    randomTables: merged.random_tables,
    connections: effectiveConnections,
    connectionState: live?.connectionState ?? {},
    visited: live?.visited ?? {},
    revealed: live?.revealed ?? {},
    summoned: live?.summoned ?? {},
    currentSceneId,
    soloMask,
  });

  const handleSelectSearchResult = (res: SearchResultEntry) => {
    setSearchQuery('');
    if (res.type === 'scene' && res.sceneId) {
      goToScene(res.sceneId);
      return;
    }
    if (res.type === 'entity' && res.entityId) {
      onOpenEntityInspector?.(res.entityId);
      return;
    }
    if (res.type === 'item' && res.sceneId && res.itemId) {
      goToScene(res.sceneId);
      const itemId = res.itemId;
      setTimeout(() => {
        const el = document.querySelector(`[data-testid="item-card-${itemId}"]`);
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 20);
    }
  };
  return (
    <header
      data-testid="zone-topbar"
      style={{
        height: '64px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'flex-end',
        gap: '5px',
        padding: '0 8px 4px',
        background: 'var(--panel)',
        borderBottom: '1px solid var(--line)',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Brand block */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: '80px',
          maxWidth: '120px',
          flexShrink: 1,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            letterSpacing: '.12em',
            color: 'var(--muted)',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          GM WORKSPACE
        </span>
        <button
          type="button"
          data-testid="act-switcher-btn"
          onClick={onOpenActSwitcher}
          style={{
            all: 'unset',
            cursor: 'pointer',
            fontFamily: 'var(--head)',
            fontWeight: 700,
            fontSize: '14px',
            color: 'var(--text)',
            minHeight: '28px',
            lineHeight: '28px',
            maxWidth: '100%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'block',
          }}
        >
          {campaignLabel} ▾
        </button>
      </div>

      {/* 2. Tracker steppers (scoped to global + current act) */}
      <div
        data-testid="topbar-trackers"
        style={{ display: 'flex', gap: '4px', flexShrink: 0 }}
      >
        {scopedTrackers.map((tr) => {
          const val = trackerValues[tr.id] ?? tr.start;
          return (
            <div
              key={tr.id}
              data-testid={`tracker-group-${tr.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                background: 'var(--p2)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '2px',
              }}
            >
              <button
                type="button"
                data-testid={`tracker-dec-${tr.id}`}
                aria-label={`Decrease ${tr.label}`}
                onClick={() => adjustTrackerValue(tr.id, -1, tr.min, tr.max)}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--p3)',
                  color: 'var(--text)',
                  fontSize: '20px',
                  cursor: 'pointer',
                }}
              >
                −
              </button>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: '34px',
                  maxWidth: '46px',
                  padding: '0 2px',
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--muted)',
                    maxWidth: '100%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {tr.label}
                </span>
                <span
                  data-testid={`tracker-val-${tr.id}`}
                  className="gm-tabular"
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '18px',
                    fontWeight: 600,
                  }}
                >
                  {val}
                </span>
              </div>
              <button
                type="button"
                data-testid={`tracker-inc-${tr.id}`}
                aria-label={`Increase ${tr.label}`}
                onClick={() => adjustTrackerValue(tr.id, 1, tr.min, tr.max)}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--p3)',
                  color: 'var(--text)',
                  fontSize: '20px',
                  cursor: 'pointer',
                }}
              >
                +
              </button>
            </div>
          );
        })}
      </div>

      {/* 3. Search field + grouped results dropdown */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          minWidth: '80px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: '10px',
            padding: '0 8px',
            height: '44px',
            boxSizing: 'border-box',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            style={{ color: 'var(--muted)', flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <label htmlFor="gm-search" className="gm-sr">
            Search the module
          </label>
          <input
            id="gm-search"
            data-testid="global-search-input"
            type="search"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              all: 'unset',
              flex: 1,
              width: '100%',
              minWidth: 0,
              color: 'var(--text)',
              fontSize: '14px',
            }}
          />
          {searchQuery.trim().length > 0 && (
            <button
              type="button"
              data-testid="clear-search-btn"
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              style={{
                all: 'unset',
                cursor: 'pointer',
                color: 'var(--muted)',
                fontSize: '12px',
                padding: '4px 6px',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {searchQuery.trim().length > 0 && (
          <div
            data-testid="search-results-dropdown"
            style={{
              position: 'absolute',
              top: '48px',
              left: 0,
              right: 0,
              maxHeight: '360px',
              overflowY: 'auto',
              background: 'var(--panel)',
              border: '1px solid var(--line2)',
              borderRadius: '12px',
              boxShadow: '0 16px 40px rgba(0,0,0,.45)',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              zIndex: 40,
              boxSizing: 'border-box',
            }}
          >
            {searchResults.length === 0 ? (
              <div
                data-testid="search-no-results"
                style={{
                  padding: '8px 10px',
                  fontSize: '13px',
                  color: 'var(--muted)',
                }}
              >
                Nothing matches that.
              </div>
            ) : (
              SEARCH_TYPE_ORDER.map((typeKey) => {
                const groupItems = searchResults.filter((r) => r.type === typeKey);
                if (groupItems.length === 0) return null;
                return (
                  <div
                    key={typeKey}
                    data-testid={`search-group-${typeKey}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: '11px',
                        letterSpacing: '.1em',
                        color: 'var(--muted)',
                        textTransform: 'uppercase',
                        padding: '4px 8px 2px',
                        fontWeight: 600,
                      }}
                    >
                      {SEARCH_TYPE_HEADINGS[typeKey]}
                    </div>
                    {groupItems.map((res) => (
                      <button
                        key={`${res.type}-${res.id}`}
                        type="button"
                        data-testid={`search-result-${res.type}-${res.id}`}
                        onClick={() => handleSelectSearchResult(res)}
                        style={{
                          minHeight: '44px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'flex-start',
                          gap: '2px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'var(--p2)',
                          color: 'var(--text)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          width: '100%',
                          boxSizing: 'border-box',
                        }}
                      >
                        <span style={{ fontSize: '14px', fontWeight: 600 }}>
                          {res.label}
                        </span>
                        {res.sublabel && (
                          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                            {res.sublabel}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 4. Review button (hidden when count is 0) */}
      {reviewCount > 0 && (
        <button
          type="button"
          data-testid="review-btn"
          onClick={onOpenReview}
          style={{
            height: '44px',
            padding: '0 7px',
            borderRadius: '10px',
            border: '1px solid var(--goldLine)',
            background: 'var(--goldBg)',
            color: 'var(--gold)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          Review {reviewCount}
        </button>
      )}

      {/* 5. Map mode segmented control */}
      <div
        data-testid="map-mode-control"
        onPointerDown={() => {
          if (!onOpenMapLibrary) return;
          clearMapLongPress();
          mapLongPressFiredRef.current = false;
          mapLongPressTimerRef.current = window.setTimeout(() => {
            mapLongPressFiredRef.current = true;
            mapLongPressTimerRef.current = null;
            onOpenMapLibrary();
            window.setTimeout(() => {
              mapLongPressFiredRef.current = false;
            }, 400);
          }, 500);
        }}
        onPointerUp={clearMapLongPress}
        onPointerCancel={clearMapLongPress}
        onPointerLeave={clearMapLongPress}
        onContextMenu={(e) => {
          if (onOpenMapLibrary) {
            e.preventDefault();
          }
        }}
        style={{
          display: 'flex',
          background: 'var(--p2)',
          border: '1px solid var(--line)',
          borderRadius: '10px',
          padding: '2px',
          gap: '2px',
          flexShrink: 0,
        }}
        role="group"
        aria-label="Map view"
      >
        {MAP_MODES.map((m) => {
          const active = mapMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                if (mapLongPressFiredRef.current) {
                  mapLongPressFiredRef.current = false;
                  return;
                }
                onSelectMapMode(m.id);
              }}
              aria-pressed={active}
              style={{
                height: '44px',
                minWidth: '44px',
                padding: '0 6px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? 'var(--onAccent)' : 'var(--text)',
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* 6. Solo Mask toggle */}
      <button
        type="button"
        data-testid="solo-mask-toggle"
        onClick={onToggleSoloMask}
        aria-pressed={soloMask}
        style={{
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '0 7px',
          borderRadius: '10px',
          fontSize: '12px',
          fontWeight: 600,
          border: soloMask ? '1px solid var(--violet)' : '1px solid var(--line)',
          background: soloMask ? 'var(--violetBg)' : 'var(--p2)',
          color: soloMask ? 'var(--violet)' : 'var(--text)',
          flexShrink: 0,
        }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span>{soloMask ? 'Solo' : 'GM'}</span>
      </button>

      {/* 6b. Table Focus Mode toggle */}
      {onToggleFocusMode && (
        <button
          type="button"
          data-testid="focus-mode-toggle"
          onClick={onToggleFocusMode}
          aria-pressed={focusMode}
          aria-label={focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
          style={{
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '0 7px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 600,
            border: focusMode ? '1px solid var(--accent)' : '1px solid var(--line)',
            background: focusMode ? 'var(--accentBg)' : 'var(--p2)',
            color: focusMode ? 'var(--accent)' : 'var(--text)',
            flexShrink: 0,
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16M15 4v16" opacity={focusMode ? 0.3 : 1} />
          </svg>
          <span>Focus</span>
        </button>
      )}

      {/* 6c. Desk View toggle */}
      {onToggleDeskMode && (
        <button
          type="button"
          data-testid="desk-view-toggle"
          onClick={onToggleDeskMode}
          aria-pressed={deskMode}
          aria-label={deskMode ? 'Exit Desk View' : 'Enter Desk View'}
          style={{
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '0 7px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 600,
            border: deskMode ? '1px solid var(--accent)' : '1px solid var(--line)',
            background: deskMode ? 'var(--accentBg)' : 'var(--p2)',
            color: deskMode ? 'var(--accent)' : 'var(--text)',
            flexShrink: 0,
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="8" height="8" rx="1.5" />
            <rect x="13" y="3" width="8" height="6" rx="1.5" />
            <rect x="13" y="11" width="8" height="10" rx="1.5" />
            <rect x="3" y="13" width="8" height="8" rx="1.5" />
          </svg>
          <span>Desk</span>
        </button>
      )}

      {/* 7. PDF button */}
      <button
        type="button"
        onClick={onOpenPdf}
        style={{
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '0 7px',
          borderRadius: '10px',
          border: '1px solid var(--line)',
          background: 'var(--p2)',
          color: 'var(--text)',
          fontSize: '12px',
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z" />
          <path d="M4 19V5" />
        </svg>
        PDF
      </button>
    </header>
  );
};
