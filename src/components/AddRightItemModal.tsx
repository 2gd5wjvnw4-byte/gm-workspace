import React, { useEffect, useState } from 'react';
import type { FactionAttitude, ModuleTruth } from '../lib/import/types';

export type AddRightItemMode = 'clock' | 'clue' | 'faction';

export interface AddRightItemModalProps {
  open: boolean;
  mode: AddRightItemMode;
  truths: ModuleTruth[];
  currentActId: string | null;
  currentSceneId: string | null;
  currentSceneTitle: string | null;
  onClose: () => void;
  onAddClock: (input: {
    name: string;
    segments: number;
    whenFull?: string;
    scope?: string;
  }) => void;
  onAddClue: (input: {
    text: string;
    truthId?: string;
    newTruthTitle?: string;
    newTruthAnswer?: string;
    sceneId?: string | null;
    sourceLabel?: string;
  }) => void;
  onAddFaction: (input: {
    name: string;
    goal?: string;
    summary?: string;
    attitude?: FactionAttitude;
    secret?: string | null;
  }) => void;
}

const NEW_TRUTH_VALUE = '__new__';

export const AddRightItemModal: React.FC<AddRightItemModalProps> = ({
  open,
  mode,
  truths,
  currentActId,
  currentSceneId,
  currentSceneTitle,
  onClose,
  onAddClock,
  onAddClue,
  onAddFaction,
}) => {
  const [clockName, setClockName] = useState('');
  const [clockSegments, setClockSegments] = useState(4);
  const [clockWhenFull, setClockWhenFull] = useState('');
  const [clockScope, setClockScope] = useState<'global' | 'act'>('global');

  const [clueText, setClueText] = useState('');
  const [truthId, setTruthId] = useState<string>(truths[0]?.id ?? NEW_TRUTH_VALUE);
  const [newTruthTitle, setNewTruthTitle] = useState('');
  const [newTruthAnswer, setNewTruthAnswer] = useState('');
  const [clueSource, setClueSource] = useState('');

  const [factionName, setFactionName] = useState('');
  const [factionGoal, setFactionGoal] = useState('');
  const [factionSummary, setFactionSummary] = useState('');
  const [factionAttitude, setFactionAttitude] = useState<FactionAttitude>('neutral');
  const [factionSecret, setFactionSecret] = useState('');

  useEffect(() => {
    if (!open) return;
    setClockName('');
    setClockSegments(4);
    setClockWhenFull('');
    setClockScope('global');
    setClueText('');
    setTruthId(truths[0]?.id ?? NEW_TRUTH_VALUE);
    setNewTruthTitle('');
    setNewTruthAnswer('');
    setClueSource(currentSceneTitle ?? '');
    setFactionName('');
    setFactionGoal('');
    setFactionSummary('');
    setFactionAttitude('neutral');
    setFactionSecret('');
  }, [open, mode, truths, currentSceneTitle]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '42px',
    padding: '8px 10px',
    borderRadius: '10px',
    border: '1px solid var(--line)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '14px',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--mono)',
    fontSize: '11px',
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
    display: 'block',
    marginBottom: '4px',
  };

  const titleText =
    mode === 'clock' ? 'Add Clock' : mode === 'clue' ? 'Add Clue' : 'Add Faction';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'clock') {
      if (!clockName.trim()) return;
      onAddClock({
        name: clockName.trim(),
        segments: clockSegments,
        whenFull: clockWhenFull.trim(),
        scope: clockScope === 'act' && currentActId ? currentActId : 'global',
      });
      onClose();
      return;
    }
    if (mode === 'clue') {
      if (!clueText.trim()) return;
      const creatingNew = truthId === NEW_TRUTH_VALUE;
      onAddClue({
        text: clueText.trim(),
        truthId: creatingNew ? undefined : truthId,
        newTruthTitle: creatingNew ? newTruthTitle.trim() || 'Improvised Mystery' : undefined,
        newTruthAnswer: creatingNew ? newTruthAnswer.trim() : undefined,
        sceneId: currentSceneId,
        sourceLabel: clueSource.trim() || undefined,
      });
      onClose();
      return;
    }
    if (!factionName.trim()) return;
    onAddFaction({
      name: factionName.trim(),
      goal: factionGoal.trim(),
      summary: factionSummary.trim(),
      attitude: factionAttitude,
      secret: factionSecret.trim() || null,
    });
    onClose();
  };

  const canSubmit =
    mode === 'clock'
      ? Boolean(clockName.trim())
      : mode === 'clue'
        ? Boolean(clueText.trim())
        : Boolean(factionName.trim());

  return (
    <div
      data-testid="add-right-item-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '24px 16px',
        overflowY: 'auto',
      }}
    >
      <form
        data-testid="add-right-item-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--head)', fontSize: '18px' }}>
            {titleText}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: '36px',
              padding: '0 12px',
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

        {mode === 'clock' && (
          <>
            <div>
              <label htmlFor="clock-name-input" style={labelStyle}>
                Clock Name
              </label>
              <input
                id="clock-name-input"
                data-testid="clock-name-input"
                type="text"
                autoFocus
                placeholder="e.g. Patrol Alert"
                value={clockName}
                onChange={(e) => setClockName(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="clock-segments-input" style={labelStyle}>
                  Segments
                </label>
                <select
                  id="clock-segments-input"
                  data-testid="clock-segments-input"
                  value={clockSegments}
                  onChange={(e) => setClockSegments(Number(e.target.value))}
                  style={inputStyle}
                >
                  {[2, 3, 4, 6, 8, 10, 12].map((n) => (
                    <option key={n} value={n}>
                      {n} segments
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="clock-scope-select" style={labelStyle}>
                  Scope
                </label>
                <select
                  id="clock-scope-select"
                  value={clockScope}
                  onChange={(e) => setClockScope(e.target.value as 'global' | 'act')}
                  style={inputStyle}
                >
                  <option value="global">Global</option>
                  {currentActId && <option value="act">Current Act ({currentActId.toUpperCase()})</option>}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="clock-when-full-input" style={labelStyle}>
                When Full (optional)
              </label>
              <input
                id="clock-when-full-input"
                data-testid="clock-when-full-input"
                type="text"
                placeholder="What happens when filled?"
                value={clockWhenFull}
                onChange={(e) => setClockWhenFull(e.target.value)}
                style={inputStyle}
              />
            </div>
          </>
        )}

        {mode === 'clue' && (
          <>
            <div>
              <label htmlFor="clue-truth-select" style={labelStyle}>
                Truth / Mystery
              </label>
              <select
                id="clue-truth-select"
                data-testid="clue-truth-select"
                value={truthId}
                onChange={(e) => setTruthId(e.target.value)}
                style={inputStyle}
              >
                {truths.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
                <option value={NEW_TRUTH_VALUE}>+ New Truth…</option>
              </select>
            </div>
            {truthId === NEW_TRUTH_VALUE && (
              <>
                <div>
                  <label htmlFor="clue-new-truth-title" style={labelStyle}>
                    New Truth Question / Title
                  </label>
                  <input
                    id="clue-new-truth-title"
                    data-testid="clue-new-truth-title"
                    type="text"
                    placeholder="e.g. Who sabotaged the relay?"
                    value={newTruthTitle}
                    onChange={(e) => setNewTruthTitle(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label htmlFor="clue-new-truth-answer" style={labelStyle}>
                    Answer (optional)
                  </label>
                  <input
                    id="clue-new-truth-answer"
                    type="text"
                    placeholder="Hidden answer until a clue is found"
                    value={newTruthAnswer}
                    onChange={(e) => setNewTruthAnswer(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </>
            )}
            <div>
              <label htmlFor="clue-text-input" style={labelStyle}>
                Clue
              </label>
              <input
                id="clue-text-input"
                data-testid="clue-text-input"
                type="text"
                autoFocus
                placeholder="What did the players discover?"
                value={clueText}
                onChange={(e) => setClueText(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="clue-source-input" style={labelStyle}>
                Source (optional)
              </label>
              <input
                id="clue-source-input"
                type="text"
                placeholder="Where it was found"
                value={clueSource}
                onChange={(e) => setClueSource(e.target.value)}
                style={inputStyle}
              />
            </div>
          </>
        )}

        {mode === 'faction' && (
          <>
            <div>
              <label htmlFor="faction-name-input" style={labelStyle}>
                Faction Name
              </label>
              <input
                id="faction-name-input"
                data-testid="faction-name-input"
                type="text"
                autoFocus
                placeholder="e.g. Dockworkers Guild"
                value={factionName}
                onChange={(e) => setFactionName(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="faction-attitude-select" style={labelStyle}>
                Starting Attitude
              </label>
              <select
                id="faction-attitude-select"
                data-testid="faction-attitude-select"
                value={factionAttitude}
                onChange={(e) => setFactionAttitude(e.target.value as FactionAttitude)}
                style={inputStyle}
              >
                <option value="allied">Allied</option>
                <option value="neutral">Neutral</option>
                <option value="suspicious">Suspicious</option>
                <option value="hostile">Hostile</option>
              </select>
            </div>
            <div>
              <label htmlFor="faction-goal-input" style={labelStyle}>
                Goal (optional)
              </label>
              <input
                id="faction-goal-input"
                data-testid="faction-goal-input"
                type="text"
                placeholder="What do they want?"
                value={factionGoal}
                onChange={(e) => setFactionGoal(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="faction-summary-input" style={labelStyle}>
                Summary (optional)
              </label>
              <input
                id="faction-summary-input"
                type="text"
                placeholder="Brief description"
                value={factionSummary}
                onChange={(e) => setFactionSummary(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="faction-secret-input" style={labelStyle}>
                Secret (optional)
              </label>
              <input
                id="faction-secret-input"
                type="text"
                placeholder="Hidden in Solo Mask"
                value={factionSecret}
                onChange={(e) => setFactionSecret(e.target.value)}
                style={inputStyle}
              />
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: '40px',
              padding: '0 14px',
              borderRadius: '10px',
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
            data-testid="add-right-item-submit"
            disabled={!canSubmit}
            style={{
              height: '40px',
              padding: '0 16px',
              borderRadius: '10px',
              border: '1px solid var(--accent)',
              background: 'var(--accent)',
              color: 'var(--onAccent)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: canSubmit ? 1 : 0.5,
            }}
          >
            {titleText}
          </button>
        </div>
      </form>
    </div>
  );
};
