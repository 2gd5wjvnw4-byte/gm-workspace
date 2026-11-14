import React from 'react';
import type { DispositionState } from '../storage/types';
import { useCampaignStore } from '../store/campaignStore';

export type DrawerMode = 'pdf' | 'entity' | null;

export interface DrawerHostProps {
  activeDrawer: DrawerMode;
  inspectedEntityId?: string | null;
  onClose: () => void;
}

const DISPOSITION_COLORS: Record<DispositionState, string> = {
  allied: 'var(--teal)',
  neutral: 'var(--muted)',
  suspicious: 'var(--gold)',
  hostile: 'var(--red)',
};

export const DrawerHost: React.FC<DrawerHostProps> = ({
  activeDrawer,
  inspectedEntityId,
  onClose,
}) => {
  const { merged, live, cycleEntityDisposition, toggleRevealedItem } =
    useCampaignStore();
  const isPdf = activeDrawer === 'pdf';
  const isEntity = activeDrawer === 'entity';
  const width = isPdf ? '480px' : '420px';
  const isOpen = isPdf || isEntity;

  const soloMask = Boolean(live?.ui?.soloMask);
  const revealed = live?.revealed ?? {};
  const entityDisposition = live?.entityDisposition ?? {};
  const improvisedEntities = live?.improvisedEntities ?? [];

  const baseEntity = inspectedEntityId
    ? merged.entities.find((e) => e.id === inspectedEntityId) ?? null
    : merged.entities[0] ?? null;

  const impEntity =
    !baseEntity && inspectedEntityId
      ? improvisedEntities.find((imp) => imp.id === inspectedEntityId) ?? null
      : null;

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

  return (
    <div
      data-testid="zone-drawer-host"
      aria-hidden={!isOpen}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width,
        background: 'var(--panel)',
        borderLeft: isOpen ? '1px solid var(--line2)' : 'none',
        boxShadow: isOpen ? '-16px 0 40px rgba(0,0,0,.35)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 200ms ease-out',
        pointerEvents: isOpen ? 'auto' : 'none',
        boxSizing: 'border-box',
      }}
    >
      {isPdf && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderBottom: '1px solid var(--line)',
            }}
          >
            <span style={{ fontWeight: 600, flex: 1 }}>
              Source PDF · printed p.1 (PDF p.1)
            </span>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: '44px',
                padding: '0 14px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--p3)',
                color: 'var(--text)',
              }}
            >
              Close
            </button>
          </div>
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
            <div
              style={{
                background: 'var(--p2)',
                border: '1px dashed var(--line2)',
                borderRadius: '12px',
                padding: '24px',
                color: 'var(--muted)',
                fontSize: '14px',
                textAlign: 'center',
              }}
            >
              DrawerHost · PDF Drawer placeholder (480px)
            </div>
          </div>
          <div
            style={{
              padding: '12px',
              borderTop: '1px solid var(--line)',
              display: 'flex',
              gap: '8px',
            }}
          >
            <button
              type="button"
              style={{
                flex: 1,
                height: '48px',
                borderRadius: '10px',
                border: '1px solid var(--tealLine)',
                background: 'var(--tealBg)',
                color: 'var(--teal)',
                fontWeight: 600,
              }}
            >
              Crop map from this page
            </button>
            <button
              type="button"
              style={{
                height: '48px',
                padding: '0 14px',
                borderRadius: '10px',
                border: '1px solid var(--line)',
                background: 'var(--p2)',
                color: 'var(--text)',
              }}
            >
              Go to page…
            </button>
          </div>
        </>
      )}

      {isEntity && (
        <>
          {baseEntity ? (
            (() => {
              const disp = entityDisposition[baseEntity.id] ?? baseEntity.disposition;
              const dispColor = DISPOSITION_COLORS[disp];
              const secretText = baseEntity.roleplay.secret
                ? soloMask
                  ? 'Hidden in Solo Mode.'
                  : baseEntity.roleplay.secret
                : 'None.';

              return (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--line)',
                    }}
                  >
                    <span
                      data-testid="inspector-entity-name"
                      style={{
                        fontFamily: 'var(--head)',
                        fontWeight: 700,
                        fontSize: '16px',
                        flex: 1,
                      }}
                    >
                      {baseEntity.name}
                    </span>
                    <button
                      type="button"
                      data-testid="inspector-disp-chip"
                      onClick={() =>
                        cycleEntityDisposition(baseEntity.id, baseEntity.disposition)
                      }
                      aria-label={`Change ${baseEntity.name} disposition (${disp})`}
                      style={{
                        ...chipStyle(dispColor),
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      {disp}
                    </button>
                    <button
                      type="button"
                      data-testid="close-entity-inspector-btn"
                      onClick={onClose}
                      style={{
                        height: '44px',
                        padding: '0 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'var(--p3)',
                        color: 'var(--text)',
                      }}
                    >
                      Close
                    </button>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                    }}
                  >
                    <div
                      data-testid="inspector-type-page"
                      style={{
                        fontSize: '13px',
                        color: 'var(--muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {baseEntity.type} · book p.{baseEntity.page}
                    </div>

                    {baseEntity.stat_line && (
                      <div
                        data-testid="inspector-stat-line"
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: '13px',
                          background: 'var(--bg)',
                          border: '1px solid var(--line)',
                          borderRadius: '10px',
                          padding: '10px',
                        }}
                      >
                        {baseEntity.stat_line}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: '11px',
                          letterSpacing: '.1em',
                          color: 'var(--muted)',
                        }}
                      >
                        VOICE
                      </span>
                      <span data-testid="inspector-voice">
                        {baseEntity.roleplay.voice || '—'}
                      </span>

                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: '11px',
                          letterSpacing: '.1em',
                          color: 'var(--muted)',
                          marginTop: '6px',
                        }}
                      >
                        GOAL
                      </span>
                      <span data-testid="inspector-goal">
                        {baseEntity.roleplay.goal || '—'}
                      </span>

                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: '11px',
                          letterSpacing: '.1em',
                          color: 'var(--muted)',
                          marginTop: '6px',
                        }}
                      >
                        SECRET
                      </span>
                      <span
                        data-testid="inspector-secret"
                        style={{
                          color: soloMask ? 'var(--muted)' : 'var(--red)',
                        }}
                      >
                        {secretText}
                      </span>
                    </div>

                    {baseEntity.clues.map((clue) => {
                      const isClueRevealed = Boolean(revealed[clue.id]);
                      const showClueText = !soloMask || isClueRevealed;
                      const btnLabel = isClueRevealed
                        ? 'Found'
                        : soloMask
                          ? 'Reveal'
                          : 'Mark found';
                      return (
                        <div
                          key={clue.id}
                          data-testid={`inspector-clue-card-${clue.id}`}
                          style={{
                            background: 'var(--tealBg)',
                            border: '1px solid var(--tealLine)',
                            borderRadius: '10px',
                            padding: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: 'var(--teal)',
                            }}
                          >
                            CLUE
                          </span>
                          <span
                            style={{
                              fontSize: '13px',
                              color: 'var(--blue)',
                              fontFamily: 'var(--mono)',
                            }}
                          >
                            {clue.check || 'No check'}
                          </span>
                          {showClueText ? (
                            <span
                              data-testid={`inspector-clue-text-${clue.id}`}
                              style={{ fontSize: '14px' }}
                            >
                              {clue.text}
                            </span>
                          ) : (
                            <span
                              data-testid={`inspector-clue-hidden-${clue.id}`}
                              style={{ fontSize: '13px', color: 'var(--muted)' }}
                            >
                              Clue hidden. Roll, then tap Reveal.
                            </span>
                          )}
                          <button
                            type="button"
                            data-testid={`inspector-clue-btn-${clue.id}`}
                            onClick={() => toggleRevealedItem(clue.id)}
                            style={{
                              alignSelf: 'flex-start',
                              height: '44px',
                              padding: '0 12px',
                              borderRadius: '8px',
                              border: '1px solid var(--tealLine)',
                              background: 'var(--panel)',
                              color: 'var(--teal)',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {btnLabel}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()
          ) : impEntity ? (
            (() => {
              const disp = entityDisposition[impEntity.id] ?? impEntity.disposition;
              const dispColor = DISPOSITION_COLORS[disp];
              return (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--line)',
                    }}
                  >
                    <span
                      data-testid="inspector-entity-name"
                      style={{
                        fontFamily: 'var(--head)',
                        fontWeight: 700,
                        fontSize: '16px',
                        flex: 1,
                      }}
                    >
                      {impEntity.name}
                    </span>
                    <span style={chipStyle('var(--gold)')}>Improvised</span>
                    <button
                      type="button"
                      data-testid="inspector-disp-chip"
                      onClick={() =>
                        cycleEntityDisposition(impEntity.id, impEntity.disposition)
                      }
                      aria-label={`Change ${impEntity.name} disposition (${disp})`}
                      style={{
                        ...chipStyle(dispColor),
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      {disp}
                    </button>
                    <button
                      type="button"
                      data-testid="close-entity-inspector-btn"
                      onClick={onClose}
                      style={{
                        height: '44px',
                        padding: '0 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'var(--p3)',
                        color: 'var(--text)',
                      }}
                    >
                      Close
                    </button>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                    }}
                  >
                    <div
                      data-testid="inspector-type-page"
                      style={{
                        fontSize: '13px',
                        color: 'var(--muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      IMPROVISED NPC
                    </div>
                    <div style={{ fontSize: '14px' }}>
                      {impEntity.summary || 'No summary provided.'}
                    </div>
                  </div>
                </>
              );
            })()
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--head)',
                    fontWeight: 700,
                    fontSize: '16px',
                    flex: 1,
                  }}
                >
                  Entity Inspector
                </span>
                <button
                  type="button"
                  data-testid="close-entity-inspector-btn"
                  onClick={onClose}
                  style={{
                    height: '44px',
                    padding: '0 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--p3)',
                    color: 'var(--text)',
                  }}
                >
                  Close
                </button>
              </div>
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  Select an entity to inspect.
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
