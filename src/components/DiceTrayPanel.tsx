import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  addDieToPool,
  formatDicePool,
  parseDiceExpression,
  QUICK_DICE_TYPES,
  rollParsedDice,
  type DicePool,
  type QuickDieType,
} from '../lib/dice';
import {
  DICE_COLOR_STYLES,
  dice3dController,
  getDiceColorStyle,
  setDiceColorStyle,
  subscribeDiceColorStyle,
  type DiceColorStyleId,
} from '../lib/dice3d';
import { useCampaignStore } from '../store/campaignStore';

export interface DiceTrayPanelProps {
  open: boolean;
  deskMode: boolean;
  onClose: () => void;
}

export const DiceTrayPanel: React.FC<DiceTrayPanelProps> = ({
  open,
  deskMode,
  onClose,
}) => {
  const appendRollLog = useCampaignStore((s) => s.appendRollLog);
  const activeCampaign = useCampaignStore((s) => s.activeCampaign);

  const [pool, setPool] = useState<DicePool>({});
  const [notation, setNotation] = useState<string>('');
  const [colorStyle, setColorStyle] = useState<DiceColorStyleId>(() => getDiceColorStyle());
  const [rolling, setRolling] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [latestRoll, setLatestRoll] = useState<{
    notation: string;
    total: number;
    diceValues: number[];
    used3d: boolean;
  } | null>(null);

  const mountedRef = useRef(true);
  const rollSeqRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    return subscribeDiceColorStyle(setColorStyle);
  }, []);

  const handleTapDie = useCallback((die: QuickDieType) => {
    setError(null);
    setPool((prev) => {
      const next = addDieToPool(prev, die);
      setNotation(formatDicePool(next));
      return next;
    });
  }, []);

  const handleClear = useCallback(() => {
    setPool({});
    setNotation('');
    setError(null);
  }, []);

  const handleSelectColor = useCallback((id: DiceColorStyleId) => {
    setColorStyle(id);
    setDiceColorStyle(id);
  }, []);

  const handleRoll = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const trimmed = notation.trim();
      if (!trimmed) return;

      const parsed = parseDiceExpression(trimmed);
      if (!parsed) {
        setError('Invalid dice notation');
        return;
      }

      setError(null);
      setPool({});
      setNotation('');

      const finishRoll = (total: number, diceValues: number[], used3d: boolean) => {
        const breakdown = diceValues.length > 1 ? ` [${diceValues.join(', ')}]` : '';
        if (activeCampaign) {
          appendRollLog({
            tableId: 'quick-roll',
            tableName: 'Quick Roll',
            roll: total,
            text: `${parsed.raw}${breakdown}`,
            entityId: null,
          });
        }
        if (mountedRef.current) {
          setRolling(false);
          setLatestRoll({
            notation: parsed.raw,
            total,
            diceValues,
            used3d,
          });
        }
      };

      if (!dice3dController.canAttempt3d(parsed.raw)) {
        const total = rollParsedDice(parsed);
        finishRoll(total, [total], false);
        return;
      }

      const seq = ++rollSeqRef.current;
      setRolling(true);
      void dice3dController
        .roll(parsed.raw, { label: `Quick Roll (${parsed.raw})` })
        .then((res) => {
          if (!res) {
            if (mountedRef.current && rollSeqRef.current === seq) {
              setRolling(false);
            }
            return;
          }
          finishRoll(res.total, res.diceValues, res.used3d);
        });
    },
    [activeCampaign, appendRollLog, notation]
  );

  if (!open) return null;

  const canRoll = notation.trim().length > 0 && !rolling;

  return (
    <section
      data-testid="dice-tray-panel"
      aria-label="Dice roller tray"
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: deskMode ? '16px' : '74px',
        zIndex: 60,
        maxWidth: 'calc(100vw - 24px)',
        background: 'var(--panel)',
        border: '1px solid var(--line2)',
        borderRadius: '14px',
        boxShadow: '0 14px 36px rgba(0, 0, 0, 0.45)',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxSizing: 'border-box',
      }}
    >
      {/* Row 1: Single-row dice buttons */}
      <div
        data-testid="dice-tray-buttons"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {QUICK_DICE_TYPES.map((die) => {
          const count = pool[die] ?? 0;
          const active = count > 0;
          return (
            <button
              key={die}
              type="button"
              data-testid={`dice-tray-die-${die}`}
              aria-pressed={active}
              onClick={() => handleTapDie(die)}
              style={{
                position: 'relative',
                minWidth: '54px',
                height: '44px',
                padding: '0 8px',
                borderRadius: '10px',
                border: active ? '1px solid var(--accent)' : '1px solid var(--line)',
                background: active ? 'var(--accentBg)' : 'var(--p3)',
                color: active ? 'var(--accent)' : 'var(--text)',
                fontFamily: 'var(--mono)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <span>{die}</span>
              {count > 0 && (
                <span
                  data-testid={`dice-tray-count-${die}`}
                  className="gm-tabular"
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '999px',
                    background: 'var(--accent)',
                    color: 'var(--onAccent)',
                    lineHeight: '14px',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Row 2: Pool input + Roll + Clear + Close */}
      <form
        onSubmit={handleRoll}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <input
          type="text"
          data-testid="dice-tray-input"
          aria-label="Dice pool notation"
          placeholder="Tap dice or type 3d6+2"
          value={notation}
          onChange={(e) => {
            setNotation(e.target.value);
            if (e.target.value.trim() === '') {
              setPool({});
            }
            if (error) setError(null);
          }}
          style={{
            flex: 1,
            minWidth: '140px',
            height: '44px',
            borderRadius: '10px',
            border: '1px solid var(--line)',
            background: 'var(--bg)',
            color: 'var(--text)',
            padding: '0 10px',
            fontFamily: 'var(--mono)',
            fontSize: '14px',
            fontWeight: 600,
            boxSizing: 'border-box',
          }}
        />
        <button
          type="submit"
          data-testid="dice-tray-roll-btn"
          disabled={!canRoll}
          style={{
            height: '44px',
            minWidth: '68px',
            padding: '0 14px',
            borderRadius: '10px',
            border: canRoll ? '1px solid var(--accent)' : '1px solid var(--line)',
            background: canRoll ? 'var(--accent)' : 'var(--p2)',
            color: canRoll ? 'var(--onAccent)' : 'var(--muted)',
            fontWeight: 700,
            fontSize: '14px',
            cursor: canRoll ? 'pointer' : 'not-allowed',
            flexShrink: 0,
          }}
        >
          {rolling ? 'Rolling…' : 'Roll'}
        </button>
        <button
          type="button"
          data-testid="dice-tray-clear-btn"
          onClick={handleClear}
          disabled={notation.trim().length === 0}
          style={{
            height: '44px',
            minWidth: '58px',
            padding: '0 10px',
            borderRadius: '10px',
            border: '1px solid var(--line)',
            background: 'var(--p3)',
            color: notation.trim().length > 0 ? 'var(--text)' : 'var(--muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: notation.trim().length > 0 ? 'pointer' : 'not-allowed',
            flexShrink: 0,
          }}
        >
          Clear
        </button>
        <button
          type="button"
          data-testid="dice-tray-close-btn"
          aria-label="Close dice tray"
          onClick={onClose}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            border: '1px solid var(--line)',
            background: 'var(--p3)',
            color: 'var(--text)',
            fontSize: '16px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </form>

      {/* Row 3: Color styles + latest result / error */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >
        <div
          data-testid="dice-tray-colors"
          role="group"
          aria-label="Dice color styles"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {DICE_COLOR_STYLES.map((preset) => {
            const selected = colorStyle === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                data-testid={`dice-color-${preset.id}`}
                aria-label={`Dice color: ${preset.label}`}
                aria-pressed={selected}
                title={preset.label}
                onClick={() => handleSelectColor(preset.id)}
                style={{
                  width: '44px',
                  height: '44px',
                  padding: 0,
                  borderRadius: '10px',
                  border: selected ? '2px solid var(--accent)' : '1px solid var(--line)',
                  background: selected ? 'var(--accentBg)' : 'var(--p2)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '999px',
                    background: preset.swatch,
                    border: '1px solid rgba(255,255,255,0.28)',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.35)',
                    display: 'block',
                  }}
                />
              </button>
            );
          })}
        </div>

        {error && (
          <div
            data-testid="dice-tray-error"
            role="alert"
            style={{
              fontSize: '12px',
              color: 'var(--red)',
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        {!error && (rolling || latestRoll) && (
          <div
            data-testid="dice-tray-result"
            className="gm-tabular"
            role="status"
            aria-live="polite"
            style={{
              background: 'var(--p3)',
              border: '1px solid var(--goldLine)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontFamily: 'var(--mono)',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--gold)',
              whiteSpace: 'nowrap',
            }}
          >
            {rolling
              ? 'Rolling 3D dice…'
              : `${latestRoll!.notation} → ${latestRoll!.total}${
                  latestRoll!.diceValues.length > 1
                    ? ` [${latestRoll!.diceValues.join(', ')}]`
                    : ''
                }`}
          </div>
        )}
      </div>
    </section>
  );
};
