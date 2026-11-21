import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { getEffectiveScenes } from '../lib/improvised';
import { playTactileClick } from '../lib/sound';
import type { DeskCardRecord, TableNote } from '../storage/types';
import { useCampaignStore } from '../store/campaignStore';

export interface DeskNotesCardBodyProps {
  card: DeskCardRecord;
  onEditNote?: (note: TableNote) => void;
  onOpenNoteModal?: () => void;
}

export const DeskNotesCardBody: React.FC<DeskNotesCardBodyProps> = ({
  card,
  onEditNote,
  onOpenNoteModal,
}) => {
  const {
    merged,
    live,
    addTableNote,
    addLooseNote,
    deleteLooseNote,
  } = useCampaignStore();

  const [noteTarget, setNoteTarget] = useState<'scene' | 'loose'>('scene');
  const [draftText, setDraftText] = useState('');
  const [confirmDeleteNote, setConfirmDeleteNote] = useState<TableNote | null>(null);

  const effectiveScenes = getEffectiveScenes(merged.scenes, live);
  const currentSceneId = live?.currentSceneId ?? effectiveScenes[0]?.id ?? null;
  const currentScene = effectiveScenes.find((s) => s.id === currentSceneId) ?? null;

  const sceneNotes = (live?.notes ?? []).filter(
    (n) => currentSceneId && n.targetId === currentSceneId
  );
  const looseNotes = live?.looseNotes ?? [];

  const handleQuickAdd = () => {
    const trimmed = draftText.trim();
    if (!trimmed) return;
    playTactileClick();
    if (noteTarget === 'scene' && currentSceneId) {
      addTableNote(currentSceneId, trimmed);
    } else {
      addLooseNote(trimmed);
    }
    setDraftText('');
  };

  return (
    <div
      data-testid={`desk-notes-body-${card.id}`}
      style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
    >
      {/* Quick add bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          padding: '8px',
          borderRadius: '10px',
          background: 'var(--p2)',
          border: '1px solid var(--line)',
        }}
      >
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            data-testid={`desk-notes-target-scene-${card.id}`}
            aria-pressed={noteTarget === 'scene'}
            disabled={!currentSceneId}
            onClick={() => setNoteTarget('scene')}
            style={{
              flex: 1,
              height: '36px',
              borderRadius: '8px',
              border:
                noteTarget === 'scene'
                  ? '1px solid var(--gold)'
                  : '1px solid var(--line)',
              background: noteTarget === 'scene' ? 'var(--goldBg)' : 'var(--bg)',
              color: noteTarget === 'scene' ? 'var(--gold)' : 'var(--muted)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: currentSceneId ? 'pointer' : 'not-allowed',
            }}
          >
            Current Scene
          </button>
          <button
            type="button"
            data-testid={`desk-notes-target-loose-${card.id}`}
            aria-pressed={noteTarget === 'loose'}
            onClick={() => setNoteTarget('loose')}
            style={{
              flex: 1,
              height: '36px',
              borderRadius: '8px',
              border:
                noteTarget === 'loose'
                  ? '1px solid var(--accent)'
                  : '1px solid var(--line)',
              background: noteTarget === 'loose' ? 'var(--accentBg)' : 'var(--bg)',
              color: noteTarget === 'loose' ? 'var(--accent)' : 'var(--muted)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Loose Note
          </button>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            data-testid={`desk-notes-input-${card.id}`}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleQuickAdd();
              }
            }}
            placeholder={
              noteTarget === 'scene'
                ? `Note for ${currentScene?.title ?? 'scene'}…`
                : 'Add loose table note…'
            }
            style={{
              flex: 1,
              minWidth: 0,
              height: '44px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid var(--line2)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '13px',
            }}
          />
          <button
            type="button"
            data-testid={`desk-notes-add-btn-${card.id}`}
            onClick={handleQuickAdd}
            disabled={!draftText.trim()}
            style={{
              minWidth: '58px',
              height: '44px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid var(--accent)',
              background: draftText.trim() ? 'var(--accent)' : 'var(--p3)',
              color: draftText.trim() ? 'var(--onAccent)' : 'var(--faint)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: draftText.trim() ? 'pointer' : 'not-allowed',
              flexShrink: 0,
            }}
          >
            Add
          </button>
        </div>
      </div>

      {onOpenNoteModal && (
        <button
          type="button"
          data-testid={`desk-notes-override-btn-${card.id}`}
          onClick={onOpenNoteModal}
          style={{
            height: '44px',
            borderRadius: '10px',
            border: '1px solid var(--goldLine)',
            background: 'var(--goldBg)',
            color: 'var(--gold)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Override Scene / Add Note
        </button>
      )}

      {/* Current Scene Notes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--gold)',
          }}
        >
          Scene Notes ({sceneNotes.length})
        </div>
        {sceneNotes.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            No notes on {currentScene?.title ?? 'current scene'}.
          </div>
        ) : (
          sceneNotes.map((note) => (
            <button
              key={note.id}
              type="button"
              data-testid={`desk-scene-note-${note.id}`}
              onClick={() => onEditNote?.(note)}
              style={{
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: '8px',
                background: 'var(--deltaBg)',
                border: '1px solid var(--gold)',
                color: 'var(--deltaText)',
                fontSize: '13px',
                whiteSpace: 'pre-wrap',
                cursor: 'pointer',
              }}
            >
              {note.text}
            </button>
          ))
        )}
      </div>

      {/* Loose Notes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
          }}
        >
          Loose Notes ({looseNotes.length})
        </div>
        {looseNotes.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            No loose notes yet.
          </div>
        ) : (
          looseNotes.map((note) => (
            <div
              key={note.id}
              data-testid={`desk-loose-note-${note.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '8px',
                background: 'var(--p2)',
                border: '1px solid var(--line)',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  color: 'var(--text)',
                  whiteSpace: 'pre-wrap',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {note.text}
              </span>
              <button
                type="button"
                data-testid={`desk-loose-note-delete-${note.id}`}
                aria-label="Delete loose note"
                onClick={() => setConfirmDeleteNote(note)}
                style={{
                  minWidth: '44px',
                  height: '44px',
                  borderRadius: '8px',
                  border: '1px solid var(--redLine)',
                  background: 'var(--redBg)',
                  color: 'var(--red)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Del
              </button>
            </div>
          ))
        )}
      </div>

      {/* In-app Delete Confirm Modal */}
      {confirmDeleteNote &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-testid="desk-loose-note-confirm-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm delete loose note"
            onClick={() => setConfirmDeleteNote(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: 'rgba(0, 0, 0, 0.6)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              paddingTop: '72px',
              paddingLeft: '16px',
              paddingRight: '16px',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '420px',
                background: 'var(--panel)',
                border: '1px solid var(--line2)',
                borderRadius: '14px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                color: 'var(--text)',
              }}
            >
              <div style={{ fontSize: '16px', fontWeight: 700 }}>
                Delete loose note?
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--muted)',
                  background: 'var(--p2)',
                  border: '1px solid var(--line)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {confirmDeleteNote.text}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  data-testid="desk-loose-note-confirm-cancel"
                  onClick={() => setConfirmDeleteNote(null)}
                  style={{
                    height: '44px',
                    padding: '0 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--p2)',
                    color: 'var(--text)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="desk-loose-note-confirm-delete"
                  onClick={() => {
                    playTactileClick();
                    deleteLooseNote(confirmDeleteNote.id);
                    setConfirmDeleteNote(null);
                  }}
                  style={{
                    height: '44px',
                    padding: '0 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--redLine)',
                    background: 'var(--redBg)',
                    color: 'var(--red)',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
