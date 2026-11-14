import React, { useEffect, useState } from 'react';
import { useCampaignStore } from '../store/campaignStore';

export const CampaignScreen: React.FC = () => {
  const {
    campaigns,
    refreshCampaigns,
    openCampaign,
    createNewCampaign,
    errorMessage,
  } = useCampaignStore();

  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSystem, setNewSystem] = useState('');
  const [newGenre, setNewGenre] = useState('sci-fi');

  useEffect(() => {
    void refreshCampaigns();
  }, [refreshCampaigns]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim() || 'New Campaign';
    await createNewCampaign({
      title,
      system: newSystem.trim(),
      genre: newGenre.trim() || 'sci-fi',
    });
    setNewTitle('');
    setNewSystem('');
    setShowNewModal(false);
  };

  return (
    <main
      data-testid="campaign-screen"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 20px',
        background: 'var(--bg)',
        color: 'var(--text)',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            borderBottom: '1px solid var(--line)',
            paddingBottom: '16px',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
              }}
            >
              GM WORKSPACE
            </div>
            <h1
              style={{
                margin: '4px 0 0',
                fontFamily: 'var(--head)',
                fontSize: '28px',
                fontWeight: 700,
              }}
            >
              Campaigns
            </h1>
          </div>

          <button
            type="button"
            data-testid="new-campaign-btn"
            onClick={() => setShowNewModal(true)}
            style={{
              height: '44px',
              padding: '0 16px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--onAccent)',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            New campaign
          </button>
        </div>

        {errorMessage && (
          <div
            role="alert"
            style={{
              background: 'var(--redBg)',
              border: '1px solid var(--redLine)',
              color: 'var(--red)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '13px',
            }}
          >
            {errorMessage}
          </div>
        )}

        {campaigns.length === 0 ? (
          <div
            data-testid="empty-campaigns"
            style={{
              background: 'var(--panel)',
              border: '1px dashed var(--line2)',
              borderRadius: '12px',
              padding: '32px 20px',
              textAlign: 'center',
              color: 'var(--muted)',
            }}
          >
            No campaigns yet. Tap &ldquo;New campaign&rdquo; to begin.
          </div>
        ) : (
          <div
            data-testid="campaign-list"
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            {campaigns.map((camp) => (
              <div
                key={camp.id}
                data-testid={`campaign-row-${camp.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  background: 'var(--panel)',
                  border: '1px solid var(--line)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--head)',
                      fontSize: '17px',
                      fontWeight: 700,
                      color: 'var(--text)',
                    }}
                  >
                    {camp.title}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {[camp.system, camp.genre].filter(Boolean).join(' · ') || camp.moduleId}
                    {' · '}
                    Updated {new Date(camp.updatedAt).toLocaleDateString()}
                  </span>
                </div>

                <button
                  type="button"
                  data-testid={`open-campaign-${camp.id}`}
                  onClick={() => void openCampaign(camp.id)}
                  style={{
                    height: '44px',
                    minWidth: '80px',
                    padding: '0 16px',
                    borderRadius: '10px',
                    border: '1px solid var(--accent)',
                    background: 'var(--accentBg)',
                    color: 'var(--accent)',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top-anchored modal for New campaign (iPad keyboard safe) */}
      {showNewModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New campaign"
          data-testid="new-campaign-modal"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '48px',
            zIndex: 50,
          }}
        >
          <form
            onSubmit={(e) => void handleCreate(e)}
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'var(--panel)',
              border: '1px solid var(--line2)',
              borderRadius: '14px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--head)',
                fontSize: '18px',
                fontWeight: 700,
              }}
            >
              New campaign
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Campaign title
              </span>
              <input
                type="text"
                data-testid="new-campaign-title-input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="The Silent Relay"
                autoFocus
                style={{
                  height: '44px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '15px',
                }}
              />
            </label>

            <div style={{ display: 'flex', gap: '10px' }}>
              <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>System</span>
                <input
                  type="text"
                  value={newSystem}
                  onChange={(e) => setNewSystem(e.target.value)}
                  placeholder="Mothership 1e"
                  style={{
                    height: '44px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: '14px',
                  }}
                />
              </label>

              <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Genre</span>
                <input
                  type="text"
                  value={newGenre}
                  onChange={(e) => setNewGenre(e.target.value)}
                  placeholder="sci-fi horror"
                  style={{
                    height: '44px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: '14px',
                  }}
                />
              </label>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                style={{
                  height: '44px',
                  padding: '0 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--line)',
                  background: 'var(--p3)',
                  color: 'var(--text)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="create-campaign-submit"
                style={{
                  height: '44px',
                  padding: '0 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--accent)',
                  color: 'var(--onAccent)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
};
