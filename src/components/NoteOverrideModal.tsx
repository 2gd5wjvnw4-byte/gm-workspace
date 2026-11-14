import React, { useEffect, useState } from 'react';
import type {
  ConnectionOverrideState,
  DispositionState,
  TableNote,
} from '../storage/types';
import {
  buildUnlockingItemsByConnection,
  getEffectiveConnectionState,
} from '../lib/solo';
import { useCampaignStore } from '../store/campaignStore';

export interface NoteOverrideModalProps {
  open: boolean;
  editingNote: TableNote | null;
  onClose: () => void;
}

const CONNECTION_STATES: ConnectionOverrideState[] = [
  'open',
  'locked',
  'sealed',
  'hidden',
];

const DISPOSITIONS: DispositionState[] = [
  'allied',
  'neutral',
  'suspicious',
  'hostile',
];

export const NoteOverrideModal: React.FC<NoteOverrideModalProps> = ({
  open,
  editingNote,
  onClose,
}) => {
  const {
    merged,
    live,
    addTableNote,
    updateTableNote,
    deleteTableNote,
    setConnectionOverride,
    addImprovisedEntity,
  } = useCampaignStore();

  const currentSceneId = live?.currentSceneId ?? merged.scenes[0]?.id ?? '';
  const [targetId, setTargetId] = useState<string>(currentSceneId);
  const [noteText, setNoteText] = useState<string>('');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  const [npcName, setNpcName] = useState<string>('');
  const [npcSummary, setNpcSummary] = useState<string>('');
  const [npcDisposition, setNpcDisposition] = useState<DispositionState>('neutral');
  const [npcTrackLabel, setNpcTrackLabel] = useState<string>('HP');
  const [npcTrackMax, setNpcTrackMax] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    if (editingNote) {
      setTargetId(editingNote.targetId);
      setNoteText(editingNote.text);
      setActiveNoteId(editingNote.id);
    } else {
      setTargetId(currentSceneId);
      setNoteText('');
      setActiveNoteId(null);
      setNpcName('');
      setNpcSummary('');
      setNpcDisposition('neutral');
      setNpcTrackLabel('HP');
      setNpcTrackMax('');
    }
  }, [open, editingNote, currentSceneId]);

  if (!open) {
    return null;
  }

  const unlockingMap = buildUnlockingItemsByConnection(merged.scenes);
  const connectionState = live?.connectionState ?? {};
  const revealed = live?.revealed ?? {};

  const syncNoteToStore = (nextText: string, nextTargetId: string) => {
    const trimmed = nextText.trim();
    const resolvedTarget = nextTargetId || currentSceneId;
    if (!trimmed) {
      if (activeNoteId) {
        deleteTableNote(activeNoteId);
        setActiveNoteId(null);
      }
      return;
    }
    if (activeNoteId) {
      updateTableNote(activeNoteId, trimmed, resolvedTarget);
    } else {
      const created = addTableNote(resolvedTarget, trimmed);
      if (created) {
        setActiveNoteId(created.id);
      }
    }
  };

  const handleTargetChange = (nextTargetId: string) => {
    setTargetId(nextTargetId);
    if (activeNoteId && noteText.trim()) {
      updateTableNote(activeNoteId, noteText.trim(), nextTargetId || currentSceneId);
    }
  };

  const handleTextChange = (nextText: string) => {
    setNoteText(nextText);
    syncNoteToStore(nextText, targetId);
  };

  const handleDeleteNote = () => {
    const idToDelete = activeNoteId ?? editingNote?.id;
    if (!idToDelete) return;
    deleteTableNote(idToDelete);
    setActiveNoteId(null);
    onClose();
  };

  const handleAddNpc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!npcName.trim() || !currentSceneId) return;
    const parsedMax = npcTrackMax.trim() ? Number(npcTrackMax) : null;
    addImprovisedEntity({
      name: npcName,
      summary: npcSummary,
      disposition: npcDisposition,
      sceneId: currentSceneId,
      trackLabel: npcTrackLabel,
      trackMax: parsedMax,
    });
    setNpcName('');
    setNpcSummary('');
    setNpcTrackMax('');
  };

  return (
    <div
      data-testid="note-override-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '48px',
        zIndex: 50,
        boxSizing: 'border-box',
      }}
    >
      <div
        data-testid="note-override-modal-card"
        style={{
          width: '540px',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 96px)',
          overflowY: 'auto',
          background: 'var(--panel)',
          border: '1px solid var(--line2)',
          borderRadius: '14px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 20px 50px rgba(0,0,0,.45)',
          boxSizing: 'border-box',
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
              fontFamily: 'var(--head)',
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text)',
            }}
          >
            {editingNote ? 'Edit Table Note' : 'Override Scene / Add Note'}
          </span>
          <button
            type="button"
            data-testid="close-note-modal-btn"
            onClick={onClose}
            style={{
              height: '44px',
              padding: '0 14px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--p3)',
              color: 'var(--text)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>

        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="note-target-select"
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                letterSpacing: '.1em',
                color: 'var(--muted)',
                textTransform: 'uppercase',
              }}
            >
              Target
            </label>
            <select
              id="note-target-select"
              data-testid="note-target-select"
              value={targetId}
              onChange={(e) => handleTargetChange(e.target.value)}
              style={{
                height: '44px',
                borderRadius: '10px',
                border: '1px solid var(--line)',
                background: 'var(--bg)',
                color: 'var(--text)',
                padding: '0 12px',
                fontSize: '14px',
              }}
            >
              {merged.scenes.map((scene) => (
                <option key={scene.id} value={scene.id}>
                  Scene #{scene.code} · {scene.title} ({scene.id})
                </option>
              ))}
              {merged.entities.map((ent) => (
                <option key={ent.id} value={ent.id}>
                  Entity · {ent.name} ({ent.id})
                </option>
              ))}
              {(live?.improvisedEntities ?? []).map((imp) => (
                <option key={imp.id} value={imp.id}>
                  Improvised · {imp.name} ({imp.id})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label
                htmlFor="note-text-input"
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '11px',
                  letterSpacing: '.1em',
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                }}
              >
                Table note
              </label>
              <span
                data-testid="note-autosave-hint"
                style={{ fontSize: '11px', color: 'var(--muted)' }}
              >
                Saves automatically
              </span>
            </div>
            <textarea
              id="note-text-input"
              data-testid="note-text-input"
              value={noteText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Write what changed at the table…"
              rows={3}
              style={{
                borderRadius: '10px',
                border: '1px solid var(--line)',
                background: 'var(--bg)',
                color: 'var(--text)',
                padding: '10px 12px',
                fontSize: '14px',
                fontFamily: 'var(--body)',
                resize: 'vertical',
              }}
            />
          </div>

          {editingNote && (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start' }}>
              <button
                type="button"
                data-testid="delete-note-btn"
                onClick={handleDeleteNote}
                style={{
                  height: '44px',
                  padding: '0 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--redLine)',
                  background: 'var(--redBg)',
                  color: 'var(--red)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Delete Note
              </button>
            </div>
          )}
        </div>

        {!editingNote && (
          <form
            onSubmit={handleAddNpc}
            data-testid="new-npc-section"
            style={{
              borderTop: '1px solid var(--line)',
              paddingTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
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
              New NPC (Improvised in Current Scene)
            </span>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                data-testid="new-npc-name-input"
                value={npcName}
                onChange={(e) => setNpcName(e.target.value)}
                placeholder="NPC name…"
                aria-label="Improvised NPC name"
                style={{
                  flex: 1,
                  minWidth: '160px',
                  height: '44px',
                  borderRadius: '10px',
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  padding: '0 12px',
                  fontSize: '14px',
                }}
              />
              <select
                data-testid="new-npc-disp-select"
                value={npcDisposition}
                onChange={(e) => setNpcDisposition(e.target.value as DispositionState)}
                aria-label="Improvised NPC disposition"
                style={{
                  height: '44px',
                  borderRadius: '10px',
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  padding: '0 12px',
                  fontSize: '13px',
                  textTransform: 'capitalize',
                }}
              >
                {DISPOSITIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="text"
              data-testid="new-npc-summary-input"
              value={npcSummary}
              onChange={(e) => setNpcSummary(e.target.value)}
              placeholder="Short summary (voice, look, or role)…"
              aria-label="Improvised NPC summary"
              style={{
                height: '44px',
                borderRadius: '10px',
                border: '1px solid var(--line)',
                background: 'var(--bg)',
                color: 'var(--text)',
                padding: '0 12px',
                fontSize: '14px',
              }}
            />

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                data-testid="new-npc-track-label-input"
                value={npcTrackLabel}
                onChange={(e) => setNpcTrackLabel(e.target.value)}
                placeholder="Track label (e.g. HP)"
                aria-label="Improvised NPC track label"
                style={{
                  width: '130px',
                  height: '44px',
                  borderRadius: '10px',
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  padding: '0 12px',
                  fontSize: '13px',
                }}
              />
              <input
                type="number"
                min={1}
                data-testid="new-npc-track-max-input"
                value={npcTrackMax}
                onChange={(e) => setNpcTrackMax(e.target.value)}
                placeholder="Max (optional)"
                aria-label="Improvised NPC track max"
                style={{
                  width: '130px',
                  height: '44px',
                  borderRadius: '10px',
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  padding: '0 12px',
                  fontSize: '13px',
                }}
              />
              <button
                type="submit"
                data-testid="add-improvised-npc-btn"
                disabled={!npcName.trim()}
                style={{
                  marginLeft: 'auto',
                  height: '44px',
                  padding: '0 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--goldLine)',
                  background: 'var(--goldBg)',
                  color: 'var(--gold)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: npcName.trim() ? 'pointer' : 'default',
                  opacity: npcName.trim() ? 1 : 0.6,
                }}
              >
                Add NPC to Scene
              </button>
            </div>
          </form>
        )}

        {!editingNote && merged.connections.length > 0 && (
          <div
            style={{
              borderTop: '1px solid var(--line)',
              paddingTop: '12px',
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
                textTransform: 'uppercase',
              }}
            >
              Connection State Overrides
            </span>
            {merged.connections.map((conn) => {
              const effState = getEffectiveConnectionState(
                conn,
                connectionState,
                revealed,
                unlockingMap
              );
              return (
                <div
                  key={conn.id}
                  data-testid={`conn-override-row-${conn.id}`}
                  style={{
                    background: 'var(--p2)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>
                      {conn.label}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: '11px',
                        color: 'var(--muted)',
                      }}
                    >
                      {conn.from} → {conn.to}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {CONNECTION_STATES.map((st) => {
                      const active = effState === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          data-testid={`conn-override-${conn.id}-${st}`}
                          aria-pressed={active}
                          onClick={() => setConnectionOverride(conn.id, st)}
                          style={{
                            height: '44px',
                            padding: '0 10px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            textTransform: 'capitalize',
                            border: active
                              ? '1px solid var(--accent)'
                              : '1px solid var(--line)',
                            background: active ? 'var(--accentBg)' : 'var(--p3)',
                            color: active ? 'var(--accent)' : 'var(--text)',
                            cursor: 'pointer',
                          }}
                        >
                          {st}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
