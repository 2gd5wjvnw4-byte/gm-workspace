import React, { useEffect, useRef, useState } from 'react';
import {
  stripFileExtension,
  validateSheetUploadFile,
} from '../lib/playerSheets';
import { playTactileClick } from '../lib/sound';
import type { PlayerSheetKind, PlayerSheetRecord } from '../storage/types';
import { useCampaignStore } from '../store/campaignStore';

export interface AddPlayerSheetModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (sheet: PlayerSheetRecord) => void;
}

interface DraftTrack {
  key: string;
  label: string;
  max: string;
}

export const AddPlayerSheetModal: React.FC<AddPlayerSheetModalProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const { addPrebuiltPlayerSheet, addFilePlayerSheet } = useCampaignStore();
  const [kind, setKind] = useState<PlayerSheetKind>('prebuilt');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [statLine, setStatLine] = useState('');
  const [notes, setNotes] = useState('');
  const [tracks, setTracks] = useState<DraftTrack[]>([
    { key: 't-1', label: 'HP', max: '10' },
  ]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validatedMime, setValidatedMime] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind('prebuilt');
    setName('');
    setRole('');
    setStatLine('');
    setNotes('');
    setTracks([{ key: 't-1', label: 'HP', max: '10' }]);
    setSelectedFile(null);
    setValidatedMime('');
    setError(null);
    setSaving(false);
  }, [open]);

  if (!open) return null;

  const handleSelectKind = (nextKind: PlayerSheetKind) => {
    playTactileClick();
    setKind(nextKind);
    setSelectedFile(null);
    setValidatedMime('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      setValidatedMime('');
      return;
    }
    const expected = kind === 'pdf' ? 'pdf' : 'image';
    const check = validateSheetUploadFile(file, expected);
    if (!check.ok) {
      setSelectedFile(null);
      setValidatedMime('');
      setError(check.error);
      return;
    }
    setError(null);
    setSelectedFile(file);
    setValidatedMime(check.mimeType);
    if (!name.trim()) {
      setName(stripFileExtension(file.name));
    }
  };

  const handleAddDraftTrack = () => {
    playTactileClick();
    setTracks((prev) => [
      ...prev,
      { key: `t-${Date.now()}-${prev.length}`, label: '', max: '6' },
    ]);
  };

  const handleRemoveDraftTrack = (key: string) => {
    playTactileClick();
    setTracks((prev) => prev.filter((t) => t.key !== key));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (kind === 'prebuilt') {
      if (!name.trim()) {
        setError('Please enter a character name.');
        return;
      }
      const parsedTracks = tracks
        .filter((t) => t.label.trim().length > 0)
        .map((t) => {
          const maxNum = Number.parseInt(t.max, 10);
          return {
            label: t.label.trim(),
            max: Number.isFinite(maxNum) && maxNum > 0 ? maxNum : 1,
          };
        });
      const created = addPrebuiltPlayerSheet({
        name: name.trim(),
        role: role.trim(),
        statLine: statLine.trim(),
        tracks: parsedTracks,
        notes: notes.trim(),
      });
      if (created) {
        onCreated?.(created);
        onClose();
      }
      return;
    }

    if (!selectedFile) {
      setError(
        kind === 'pdf'
          ? 'Please choose a PDF file first.'
          : 'Please choose an image file (.png, .jpg, .webp) first.'
      );
      return;
    }

    const check = validateSheetUploadFile(selectedFile, kind);
    if (!check.ok) {
      setError(check.error);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const created = await addFilePlayerSheet({
        kind,
        name: name.trim() || stripFileExtension(selectedFile.name),
        data: selectedFile,
        mimeType: validatedMime || check.mimeType,
        fileName: selectedFile.name,
      });
      if (created) {
        onCreated?.(created);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save sheet file.');
    } finally {
      setSaving(false);
    }
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    height: '44px',
    borderRadius: '8px',
    border: active ? '1px solid var(--accent)' : '1px solid var(--line)',
    background: active ? 'var(--accentBg)' : 'var(--p2)',
    color: active ? 'var(--accent)' : 'var(--text)',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
  });

  const inputStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '44px',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid var(--line)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '14px',
    fontFamily: 'var(--body)',
    boxSizing: 'border-box',
  };

  return (
    <div
      data-testid="add-player-sheet-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Add Player Character Sheet"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '24px 16px',
        overflowY: 'auto',
      }}
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '500px',
          background: 'var(--panel)',
          border: '1px solid var(--line2)',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 20px 48px rgba(0,0,0,0.45)',
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
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--head)',
              fontSize: '18px',
              fontWeight: 700,
            }}
          >
            Add Player Character Sheet
          </h2>
          <button
            type="button"
            data-testid="add-player-sheet-close"
            onClick={onClose}
            style={{
              minWidth: '44px',
              height: '44px',
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
            Close
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            data-testid="add-sheet-tab-prebuilt"
            aria-pressed={kind === 'prebuilt'}
            onClick={() => handleSelectKind('prebuilt')}
            style={tabStyle(kind === 'prebuilt')}
          >
            Prebuilt
          </button>
          <button
            type="button"
            data-testid="add-sheet-tab-image"
            aria-pressed={kind === 'image'}
            onClick={() => handleSelectKind('image')}
            style={tabStyle(kind === 'image')}
          >
            Image
          </button>
          <button
            type="button"
            data-testid="add-sheet-tab-pdf"
            aria-pressed={kind === 'pdf'}
            onClick={() => handleSelectKind('pdf')}
            style={tabStyle(kind === 'pdf')}
          >
            PDF
          </button>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--muted)',
            }}
          >
            Character Name
          </span>
          <input
            type="text"
            data-testid="add-sheet-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === 'prebuilt' ? 'e.g. Aria Voss' : 'Auto-filled from file name'}
            style={inputStyle}
          />
        </label>

        {kind === 'prebuilt' ? (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--muted)',
                }}
              >
                Role / Class
              </span>
              <input
                type="text"
                data-testid="add-sheet-role-input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Pilot, Level 3 Ranger"
                style={inputStyle}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--muted)',
                }}
              >
                Stat Line
              </span>
              <input
                type="text"
                data-testid="add-sheet-statline-input"
                value={statLine}
                onChange={(e) => setStatLine(e.target.value)}
                placeholder="e.g. STR 10 · DEX 16 · AC 14 · Move 30"
                style={{ ...inputStyle, fontFamily: 'var(--mono)', fontSize: '13px' }}
              />
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--muted)',
                  }}
                >
                  Tracks (HP, Stress, Ammo)
                </span>
                <button
                  type="button"
                  data-testid="add-sheet-add-track-row"
                  onClick={handleAddDraftTrack}
                  style={{
                    height: '44px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--p2)',
                    color: 'var(--accent)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Track
                </button>
              </div>
              {tracks.map((trk, idx) => (
                <div
                  key={trk.key}
                  style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
                >
                  <input
                    type="text"
                    aria-label={`Track ${idx + 1} label`}
                    data-testid={`add-sheet-track-label-${idx}`}
                    value={trk.label}
                    onChange={(e) =>
                      setTracks((prev) =>
                        prev.map((item) =>
                          item.key === trk.key ? { ...item, label: e.target.value } : item
                        )
                      )
                    }
                    placeholder="Track name"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <input
                    type="number"
                    min={1}
                    aria-label={`Track ${idx + 1} max`}
                    data-testid={`add-sheet-track-max-${idx}`}
                    value={trk.max}
                    onChange={(e) =>
                      setTracks((prev) =>
                        prev.map((item) =>
                          item.key === trk.key ? { ...item, max: e.target.value } : item
                        )
                      )
                    }
                    placeholder="Max"
                    style={{ ...inputStyle, width: '84px', fontFamily: 'var(--mono)' }}
                  />
                  <button
                    type="button"
                    aria-label={`Remove track ${idx + 1}`}
                    onClick={() => handleRemoveDraftTrack(trk.key)}
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--p3)',
                      color: 'var(--muted)',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--muted)',
                }}
              >
                Notes
              </span>
              <textarea
                data-testid="add-sheet-notes-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Gear, abilities, conditions, or table notes"
                style={{ ...inputStyle, minHeight: '76px', resize: 'vertical' }}
              />
            </label>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--muted)',
              }}
            >
              {kind === 'pdf' ? 'PDF File (.pdf)' : 'Image File (.png, .jpg, .webp)'}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              data-testid="add-sheet-file-input"
              accept={
                kind === 'pdf'
                  ? '.pdf,application/pdf'
                  : '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp'
              }
              onChange={handleFileChange}
              style={{
                ...inputStyle,
                padding: '10px',
              }}
            />
            {selectedFile && (
              <div
                data-testid="add-sheet-selected-file"
                style={{
                  fontSize: '12px',
                  color: 'var(--teal)',
                  fontFamily: 'var(--mono)',
                }}
              >
                Selected: {selectedFile.name}
              </div>
            )}
          </div>
        )}

        {error && (
          <div
            data-testid="add-sheet-error"
            role="alert"
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'var(--redBg)',
              border: '1px solid var(--redLine)',
              color: 'var(--red)',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
          <button
            type="button"
            onClick={onClose}
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
            type="submit"
            data-testid="add-sheet-submit-btn"
            disabled={saving}
            style={{
              height: '44px',
              padding: '0 18px',
              borderRadius: '8px',
              border: '1px solid var(--accent)',
              background: 'var(--accent)',
              color: 'var(--onAccent)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save Sheet'}
          </button>
        </div>
      </form>
    </div>
  );
};
