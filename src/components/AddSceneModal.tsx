import React, { useEffect, useState } from 'react';
import type { ModuleAct, ModuleScene, SceneArchetype } from '../lib/import/types';

export type AddModalMode = 'area' | 'scene' | 'node';

export interface AddSceneModalProps {
  open: boolean;
  mode: AddModalMode;
  acts: ModuleAct[];
  defaultActId: string;
  defaultArea?: string;
  areas: string[];
  scenes: ModuleScene[];
  currentSceneId: string | null;
  suggestedCode: string;
  onClose: () => void;
  onAddArea: (input: { name: string; actId: string }) => void;
  onAddScene: (input: {
    title: string;
    code?: string;
    area?: string;
    actId: string;
    archetype: SceneArchetype;
    summary?: string;
    connectFromSceneId?: string | null;
    twoWay: boolean;
  }) => void;
}

const ARCHETYPE_OPTIONS: Array<{ value: SceneArchetype; label: string }> = [
  { value: 'physical_zone', label: 'Physical Zone' },
  { value: 'open_hub', label: 'Open Hub' },
  { value: 'investigation', label: 'Investigation' },
  { value: 'action_stage', label: 'Action Stage' },
];

export const AddSceneModal: React.FC<AddSceneModalProps> = ({
  open,
  mode,
  acts,
  defaultActId,
  defaultArea = '',
  areas,
  scenes,
  currentSceneId,
  suggestedCode,
  onClose,
  onAddArea,
  onAddScene,
}) => {
  const [actId, setActId] = useState(defaultActId);
  const [areaName, setAreaName] = useState('');
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [area, setArea] = useState(defaultArea);
  const [archetype, setArchetype] = useState<SceneArchetype>('physical_zone');
  const [summary, setSummary] = useState('');
  const [connectFrom, setConnectFrom] = useState<string>(currentSceneId ?? '');
  const [twoWay, setTwoWay] = useState(true);

  useEffect(() => {
    if (!open) return;
    setActId(defaultActId);
    setAreaName('');
    setTitle('');
    setCode('');
    setArea(defaultArea);
    setArchetype('physical_zone');
    setSummary('');
    setConnectFrom(currentSceneId ?? '');
    setTwoWay(true);
  }, [open, mode, defaultActId, defaultArea, currentSceneId]);

  if (!open) return null;

  const heading =
    mode === 'area'
      ? 'Add Area'
      : mode === 'node'
        ? 'Add Map Node'
        : 'Add Scene';

  const inputStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '44px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid var(--line)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: 'var(--body)',
    fontSize: '14px',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--mono)',
    fontSize: '11px',
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
    marginBottom: '6px',
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'area') {
      if (!areaName.trim()) return;
      onAddArea({ name: areaName.trim(), actId });
      onClose();
      return;
    }
    if (!title.trim()) return;
    onAddScene({
      title: title.trim(),
      code: code.trim() || undefined,
      area: area.trim() || undefined,
      actId,
      archetype,
      summary: summary.trim() || undefined,
      connectFromSceneId: connectFrom || null,
      twoWay,
    });
    onClose();
  };

  return (
    <div
      data-testid="add-scene-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '72px 16px 24px',
        overflowY: 'auto',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        data-testid="add-scene-modal"
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: '14px',
          padding: '16px',
          color: 'var(--text)',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
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
            {heading}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              minWidth: '44px',
              minHeight: '44px',
              borderRadius: '10px',
              border: '1px solid var(--line)',
              background: 'var(--p3)',
              color: 'var(--text)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {acts.length > 1 && (
            <div>
              <label htmlFor="add-scene-act" style={labelStyle}>
                Act
              </label>
              <select
                id="add-scene-act"
                value={actId}
                onChange={(e) => setActId(e.target.value)}
                style={inputStyle}
              >
                {acts.map((act) => (
                  <option key={act.id} value={act.id}>
                    {act.id.toUpperCase()} · {act.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === 'area' ? (
            <div>
              <label htmlFor="add-area-name" style={labelStyle}>
                Area Name
              </label>
              <input
                id="add-area-name"
                type="text"
                autoFocus
                placeholder="e.g. Lower Maintenance Deck"
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
                style={inputStyle}
              />
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="add-scene-title" style={labelStyle}>
                    Scene Title
                  </label>
                  <input
                    id="add-scene-title"
                    type="text"
                    autoFocus
                    placeholder="e.g. Hidden Airlock"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ width: '96px' }}>
                  <label htmlFor="add-scene-code" style={labelStyle}>
                    Code
                  </label>
                  <input
                    id="add-scene-code"
                    type="text"
                    placeholder={suggestedCode}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    style={{ ...inputStyle, fontFamily: 'var(--mono)' }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="add-scene-area" style={labelStyle}>
                  Area (optional)
                </label>
                <input
                  id="add-scene-area"
                  type="text"
                  list="add-scene-area-options"
                  placeholder="Pick or type an area name"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  style={inputStyle}
                />
                {areas.length > 0 && (
                  <datalist id="add-scene-area-options">
                    {areas.map((a) => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="add-scene-archetype" style={labelStyle}>
                    Archetype
                  </label>
                  <select
                    id="add-scene-archetype"
                    value={archetype}
                    onChange={(e) => setArchetype(e.target.value as SceneArchetype)}
                    style={inputStyle}
                  >
                    {ARCHETYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label htmlFor="add-scene-connect" style={labelStyle}>
                    Connect From
                  </label>
                  <select
                    id="add-scene-connect"
                    value={connectFrom}
                    onChange={(e) => setConnectFrom(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">None (unconnected)</option>
                    {scenes.map((s) => (
                      <option key={s.id} value={s.id}>
                        #{s.code} {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {connectFrom && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minHeight: '44px',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={twoWay}
                    onChange={(e) => setTwoWay(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>Two-way exit (can return to previous scene)</span>
                </label>
              )}

              <div>
                <label htmlFor="add-scene-summary" style={labelStyle}>
                  Summary (optional)
                </label>
                <textarea
                  id="add-scene-summary"
                  rows={2}
                  placeholder="Quick note about what is here..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  style={{ ...inputStyle, minHeight: '64px', resize: 'vertical' }}
                />
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                minHeight: '44px',
                padding: '0 16px',
                borderRadius: '10px',
                border: '1px solid var(--line)',
                background: 'var(--p3)',
                color: 'var(--text)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="add-scene-submit"
              disabled={mode === 'area' ? !areaName.trim() : !title.trim()}
              style={{
                minHeight: '44px',
                padding: '0 18px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--accent)',
                color: 'var(--onAccent)',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {mode === 'area' ? 'Save Area' : mode === 'node' ? 'Add Node' : 'Save Scene'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
