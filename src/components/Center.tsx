import React, { useEffect, useState } from 'react';
import { ExitsBar } from './ExitsBar';
import type { MapDisplayMode, TableNote } from '../storage/types';
import { getArchetypeLabels, getMaskedItemView } from '../lib/solo';
import { useCampaignStore } from '../store/campaignStore';
import type { SceneItemKind } from '../lib/import/types';

export interface CenterProps {
  mapMode: MapDisplayMode;
  onOpenPdf?: () => void;
  onEditNote?: (note: TableNote) => void;
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

export const Center: React.FC<CenterProps> = ({ mapMode, onEditNote }) => {
  const { merged, live, toggleRevealedItem } = useCampaignStore();
  const [readOpen, setReadOpen] = useState(true);

  const currentSceneId = live?.currentSceneId ?? merged.scenes[0]?.id ?? null;
  const currentScene =
    merged.scenes.find((s) => s.id === currentSceneId) ?? merged.scenes[0] ?? null;

  useEffect(() => {
    setReadOpen(true);
  }, [currentScene?.id]);

  const soloMask = Boolean(live?.ui?.soloMask);
  const revealed = live?.revealed ?? {};
  const sceneNotes = currentScene
    ? (live?.notes ?? []).filter((n) => n.targetId === currentScene.id)
    : [];

  const labels = getArchetypeLabels(
    currentScene ? currentScene.archetype : 'physical_zone'
  );

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
          <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--muted)' }}>
            MAP AREA PLACEHOLDER ({mapMode.toUpperCase()})
          </span>
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
                  style={{
                    height: '44px',
                    padding: '0 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--line)',
                    background: 'var(--p2)',
                    color: 'var(--text)',
                    fontSize: '13px',
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
              {/* Scene header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                <button
                  type="button"
                  data-testid="scene-book-page-btn"
                  style={{
                    height: '44px',
                    padding: '0 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--line)',
                    background: 'var(--p2)',
                    color: 'var(--text)',
                    fontSize: '13px',
                  }}
                >
                  Book p.{currentScene.page}
                </button>
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

              {/* Read-aloud card */}
              {currentScene.read_aloud !== null && (
                <div
                  data-testid="read-aloud-card"
                  style={{
                    background: 'var(--panel)',
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
                          padding: '12px 14px',
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
                            padding: '0 14px 14px',
                            fontSize: '16px',
                            lineHeight: 1.55,
                            fontStyle: 'italic',
                            color: 'var(--readText)',
                          }}
                        >
                          {currentScene.read_aloud}
                        </p>
                      )}
                    </>
                  ) : (
                    <div
                      style={{
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
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
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>None.</div>
                ) : (
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      fontSize: '15px',
                    }}
                  >
                    {currentScene.tier1_sensory.map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                  </ul>
                )}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={chipStyle(KIND_COLOR_VARS[view.kind])}>
                            {view.kindLabel}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: '15px', flex: 1 }}>
                            {view.label}
                          </span>
                          <button
                            type="button"
                            data-testid={`reveal-btn-${item.id}`}
                            onClick={() =>
                              toggleRevealedItem(item.id, item.unlocks_connection_id)
                            }
                            style={actionBtnStyle(view.isRevealed)}
                          >
                            {view.actionButtonLabel}
                          </button>
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--mono)',
                            fontSize: '13px',
                            color: 'var(--blue)',
                          }}
                        >
                          Check: {view.checkText}
                        </div>
                        {view.showResult && (
                          <div
                            data-testid={`item-result-${item.id}`}
                            style={{ fontSize: '14px', color: 'var(--readText)' }}
                          >
                            {view.resultText}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={chipStyle(KIND_COLOR_VARS[view.kind])}>
                            {view.kindLabel}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: '15px', flex: 1 }}>
                            {view.label}
                          </span>
                          <button
                            type="button"
                            data-testid={`reveal-btn-${item.id}`}
                            onClick={() =>
                              toggleRevealedItem(item.id, item.unlocks_connection_id)
                            }
                            style={actionBtnStyle(view.isRevealed)}
                          >
                            {view.actionButtonLabel}
                          </button>
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--mono)',
                            fontSize: '13px',
                            color: 'var(--blue)',
                          }}
                        >
                          Check: {view.checkText}
                        </div>
                        {view.showResult && (
                          <div
                            data-testid={`item-result-${item.id}`}
                            style={{ fontSize: '14px', color: 'var(--readText)' }}
                          >
                            {view.resultText}
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
                      <span style={{ fontSize: '14px' }}>{esc.text}</span>
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
                    }}
                  >
                    GM TIP ·{' '}
                  </span>
                  {currentScene.gm_tips}
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
