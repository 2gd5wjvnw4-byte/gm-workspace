import React, { useState } from 'react';
import type { MapDisplayMode } from '../storage/types';
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
  onOpenPdf: () => void;
  onOpenEntityInspector?: (entityId: string) => void;
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
  onOpenPdf,
  onOpenEntityInspector,
}) => {
  const { merged, live, adjustTrackerValue, goToScene } = useCampaignStore();
  const [searchQuery, setSearchQuery] = useState<string>('');

  const currentSceneId = live?.currentSceneId ?? merged.scenes[0]?.id ?? null;
  const currentScene =
    merged.scenes.find((s) => s.id === currentSceneId) ?? merged.scenes[0] ?? null;
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
    scenes: merged.scenes,
    entities: merged.entities,
    improvisedEntities: live?.improvisedEntities ?? [],
    truths: merged.truths,
    factions: merged.factions,
    randomTables: merged.random_tables,
    connections: merged.connections,
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
        gap: '10px',
        padding: '0 14px 4px',
        background: 'var(--panel)',
        borderBottom: '1px solid var(--line)',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Brand block */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: '140px' }}>
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            letterSpacing: '.12em',
            color: 'var(--muted)',
            textTransform: 'uppercase',
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
            fontSize: '15px',
            color: 'var(--text)',
            minHeight: '28px',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          {campaignLabel} ▾
        </button>
      </div>

      {/* 2. Tracker steppers (scoped to global + current act) */}
      <div data-testid="topbar-trackers" style={{ display: 'flex', gap: '6px' }}>
        {scopedTrackers.map((tr) => {
          const val = trackerValues[tr.id] ?? tr.start;
          return (
            <div
              key={tr.id}
              data-testid={`tracker-group-${tr.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
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
                  minWidth: '62px',
                  padding: '0 4px',
                }}
              >
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  {tr.label}
                </span>
                <span
                  data-testid={`tracker-val-${tr.id}`}
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
          minWidth: '100px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: '10px',
            padding: '0 12px',
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
                No matches found.
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
            padding: '0 10px',
            borderRadius: '10px',
            border: '1px solid var(--goldLine)',
            background: 'var(--goldBg)',
            color: 'var(--gold)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Review {reviewCount}
        </button>
      )}

      {/* 5. Map mode segmented control */}
      <div
        style={{
          display: 'flex',
          background: 'var(--p2)',
          border: '1px solid var(--line)',
          borderRadius: '10px',
          padding: '2px',
          gap: '2px',
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
              onClick={() => onSelectMapMode(m.id)}
              aria-pressed={active}
              style={{
                height: '44px',
                minWidth: '48px',
                padding: '0 8px',
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
          gap: '6px',
          padding: '0 12px',
          borderRadius: '10px',
          fontSize: '13px',
          fontWeight: 600,
          border: soloMask ? '1px solid var(--violet)' : '1px solid var(--line)',
          background: soloMask ? 'var(--violetBg)' : 'var(--p2)',
          color: soloMask ? 'var(--violet)' : 'var(--text)',
        }}
      >
        <svg
          width="18"
          height="18"
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

      {/* 7. PDF button */}
      <button
        type="button"
        onClick={onOpenPdf}
        style={{
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '0 12px',
          borderRadius: '10px',
          border: '1px solid var(--line)',
          background: 'var(--p2)',
          color: 'var(--text)',
          fontSize: '13px',
          fontWeight: 600,
        }}
      >
        <svg
          width="18"
          height="18"
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
