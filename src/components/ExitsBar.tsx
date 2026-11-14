import React from 'react';
import { getArchetypeLabels, getSceneExits } from '../lib/solo';
import { useCampaignStore } from '../store/campaignStore';

export const ExitsBar: React.FC = () => {
  const { merged, live, goToScene } = useCampaignStore();

  const currentSceneId = live?.currentSceneId ?? merged.scenes[0]?.id ?? null;
  const currentScene =
    merged.scenes.find((s) => s.id === currentSceneId) ?? merged.scenes[0] ?? null;

  const archetypeLabels = getArchetypeLabels(
    currentScene ? currentScene.archetype : 'unknown'
  );

  const soloMask = Boolean(live?.ui?.soloMask);
  const exits = currentScene
    ? getSceneExits({
        sceneId: currentScene.id,
        connections: merged.connections,
        scenes: merged.scenes,
        notLoadedTargets: merged.linkCheck.notLoadedTargets,
        connectionState: live?.connectionState ?? {},
        revealed: live?.revealed ?? {},
        soloMask,
      })
    : [];

  return (
    <div
      data-testid="zone-exits-bar"
      style={{
        flexShrink: 0,
        borderTop: '1px solid var(--line)',
        background: 'var(--panel)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
        boxSizing: 'border-box',
      }}
    >
      <span
        data-testid="exits-bar-label"
        style={{
          fontFamily: 'var(--mono)',
          fontSize: '11px',
          letterSpacing: '.1em',
          color: 'var(--muted)',
          marginRight: '4px',
          textTransform: 'uppercase',
        }}
      >
        {archetypeLabels.exits}
      </span>

      {exits.length === 0 ? (
        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
          {currentScene ? 'No exits from this scene.' : 'Import a module JSON to see exits.'}
        </span>
      ) : (
        exits.map((exit) => {
          const borderColor =
            exit.colorVariant === 'open'
              ? 'var(--accent)'
              : exit.colorVariant === 'gold'
                ? 'var(--goldLine)'
                : 'var(--line2)';
          const textColor =
            exit.colorVariant === 'open'
              ? 'var(--accent)'
              : exit.colorVariant === 'gold'
                ? 'var(--gold)'
                : 'var(--muted)';
          const bgColor = exit.disabled ? 'var(--p2)' : 'var(--accentBg)';

          return (
            <button
              key={`${exit.connectionId}-${exit.targetSceneId}`}
              type="button"
              data-testid={`exit-btn-${exit.connectionId}`}
              disabled={exit.disabled}
              onClick={() => {
                if (!exit.disabled) {
                  goToScene(exit.targetSceneId);
                }
              }}
              style={{
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 14px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                border: `1px solid ${borderColor}`,
                background: bgColor,
                color: textColor,
                cursor: exit.disabled ? 'default' : 'pointer',
              }}
            >
              <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', opacity: 0.85 }}>
                {exit.typeLabel}
              </span>
              <span>{exit.label}</span>
              <span style={{ fontSize: '11px', opacity: 0.85 }}>{exit.stateLabel}</span>
            </button>
          );
        })
      )}
    </div>
  );
};
