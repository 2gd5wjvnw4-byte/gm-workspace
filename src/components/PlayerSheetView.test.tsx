import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as pdfLib from '../lib/pdf';
import { createCampaign, db, deleteCampaign, getBlob, putBlob } from '../storage';
import { useCampaignStore } from '../store/campaignStore';
import { AddPlayerSheetModal } from './AddPlayerSheetModal';
import { DeskSheetCardBody } from './DeskSheetCardBody';
import { PlayerSheetView } from './PlayerSheetView';

describe('Player character sheets (Stage 8c)', () => {
  beforeEach(async () => {
    await deleteCampaign('camp-pc-ui');
    await db.campaigns.clear();
    await db.chunks.clear();
    await db.live.clear();
    await db.blobs.clear();
    pdfLib.clearSharedPdfDocumentCache();

    const created = await createCampaign({
      id: 'camp-pc-ui',
      title: 'Test Campaign',
      system: 'Mothership',
      genre: 'sci-fi',
    });
    await useCampaignStore.getState().openCampaign(created.campaign.id);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('creates a prebuilt sheet, steps and edits tracks, and edits fields', async () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    render(<AddPlayerSheetModal open onClose={onClose} onCreated={onCreated} />);

    fireEvent.change(screen.getByTestId('add-sheet-name-input'), {
      target: { value: 'Aria Voss' },
    });
    fireEvent.change(screen.getByTestId('add-sheet-role-input'), {
      target: { value: 'Pilot' },
    });
    fireEvent.change(screen.getByTestId('add-sheet-statline-input'), {
      target: { value: 'STR 10 · DEX 16' },
    });
    fireEvent.change(screen.getByTestId('add-sheet-notes-input'), {
      target: { value: 'Carries plasma flare.' },
    });

    fireEvent.click(screen.getByTestId('add-sheet-submit-btn'));

    expect(onCreated).toHaveBeenCalledTimes(1);
    const createdId = useCampaignStore.getState().live?.playerSheets?.[0]?.id;
    expect(createdId).toBeTruthy();

    cleanup();
    render(<PlayerSheetView sheetId={createdId!} />);

    expect(screen.getByTestId('player-sheet-name').textContent).toBe('Aria Voss');
    expect(screen.getByTestId('player-sheet-role').textContent).toBe('Pilot');
    expect(screen.getByTestId('player-sheet-statline').textContent).toBe('STR 10 · DEX 16');
    expect(screen.getByTestId('player-sheet-notes').textContent).toBe('Carries plasma flare.');

    const hpTrackId = useCampaignStore.getState().live?.playerSheets?.[0]?.tracks?.[0]?.id!;
    expect(screen.getByTestId(`player-sheet-track-val-${hpTrackId}`).textContent).toBe('10/10');

    fireEvent.click(screen.getByTestId(`player-sheet-track-dec-${hpTrackId}`));
    expect(screen.getByTestId(`player-sheet-track-val-${hpTrackId}`).textContent).toBe('9/10');

    // Add a new track
    fireEvent.change(screen.getByTestId('player-sheet-new-track-label'), {
      target: { value: 'Stress' },
    });
    fireEvent.change(screen.getByTestId('player-sheet-new-track-max'), {
      target: { value: '6' },
    });
    fireEvent.click(screen.getByTestId('player-sheet-new-track-add'));
    expect(useCampaignStore.getState().live?.playerSheets?.[0]?.tracks).toHaveLength(2);

    // Edit name and role
    fireEvent.click(screen.getByTestId('player-sheet-edit-btn'));
    fireEvent.change(screen.getByTestId('player-sheet-edit-role'), {
      target: { value: 'Ace Pilot' },
    });
    fireEvent.click(screen.getByTestId('player-sheet-save-edit-btn'));
    expect(screen.getByTestId('player-sheet-role').textContent).toBe('Ace Pilot');
  });

  it('validates image uploads, renders image from IndexedDB, and deletes via in-app confirm modal', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    const createUrlSpy = vi.fn().mockReturnValue('blob:mock-image-sheet');
    const revokeUrlSpy = vi.fn();
    URL.createObjectURL = createUrlSpy;
    URL.revokeObjectURL = revokeUrlSpy;

    try {
      render(<AddPlayerSheetModal open onClose={vi.fn()} />);
      fireEvent.click(screen.getByTestId('add-sheet-tab-image'));

      // Reject unsupported file
      const badFile = new File(['hello'], 'notes.txt', { type: 'text/plain' });
      fireEvent.change(screen.getByTestId('add-sheet-file-input'), {
        target: { files: [badFile] },
      });
      expect(screen.getByTestId('add-sheet-error').textContent).toContain('PNG, JPG, or WebP');

      // Accept PNG image
      const pngBytes = new Uint8Array([137, 80, 78, 71]);
      const goodFile = new File([pngBytes], 'kira.png', { type: 'image/png' });
      fireEvent.change(screen.getByTestId('add-sheet-file-input'), {
        target: { files: [goodFile] },
      });
      fireEvent.click(screen.getByTestId('add-sheet-submit-btn'));

      await waitFor(() => {
        expect(useCampaignStore.getState().live?.playerSheets).toHaveLength(1);
      });

      const sheet = useCampaignStore.getState().live!.playerSheets![0];
      expect(sheet.kind).toBe('image');
      expect(sheet.name).toBe('kira');
      expect(sheet.blobKey).toBeTruthy();

      cleanup();
      render(<PlayerSheetView sheetId={sheet.id} />);

      await waitFor(() => {
        const img = screen.getByTestId('player-sheet-image-el') as HTMLImageElement;
        expect(img.src).toBe('blob:mock-image-sheet');
      });

      // Delete via in-app confirm modal (never window.confirm)
      fireEvent.click(screen.getByTestId('player-sheet-delete-btn'));
      expect(screen.getByTestId('player-sheet-delete-confirm')).toBeTruthy();
      fireEvent.click(screen.getByTestId('player-sheet-delete-confirm-btn'));

      await waitFor(async () => {
        expect(useCampaignStore.getState().live?.playerSheets).toHaveLength(0);
        expect(await getBlob(sheet.blobKey!)).toBeUndefined();
      });
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(createUrlSpy).toHaveBeenCalled();
    } finally {
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
    }
  });

  it('renders a PDF sheet via pdfjs-dist and turns pages with persisted currentPage', async () => {
    const fakeDoc = {
      numPages: 3,
      destroy: () => Promise.resolve(),
    } as unknown as pdfLib.PdfDocumentProxy;
    vi.spyOn(pdfLib, 'loadPdfDocument').mockResolvedValue(fakeDoc);
    const renderSpy = vi.spyOn(pdfLib, 'renderPdfPageToCanvas').mockImplementation(() => ({
      promise: Promise.resolve(),
      cancel: () => {},
    }));

    const blobKey = 'sheet:camp-pc-ui:pc-pdf-1';
    await putBlob(blobKey, new Uint8Array([37, 80, 68, 70]), 'application/pdf', {
      fileName: 'jax.pdf',
    });

    const created = await useCampaignStore.getState().addFilePlayerSheet({
      kind: 'pdf',
      name: 'Jax Mercer',
      data: new Uint8Array([37, 80, 68, 70]),
      mimeType: 'application/pdf',
      fileName: 'jax.pdf',
    });
    expect(created).toBeTruthy();

    render(<PlayerSheetView sheetId={created!.id} />);

    await waitFor(() => {
      expect(screen.getByTestId('player-sheet-pdf-page-readout').textContent).toBe('Page 1 / 3');
    });
    expect(renderSpy).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('player-sheet-pdf-next'));
    await waitFor(() => {
      expect(screen.getByTestId('player-sheet-pdf-page-readout').textContent).toBe('Page 2 / 3');
    });
    expect(useCampaignStore.getState().live?.playerSheets?.[0]?.currentPage).toBe(2);

    fireEvent.click(screen.getByTestId('player-sheet-pdf-prev'));
    await waitFor(() => {
      expect(screen.getByTestId('player-sheet-pdf-page-readout').textContent).toBe('Page 1 / 3');
    });
  });

  it('keeps player sheets visible in DeskSheetCardBody when Solo Mask is ON', () => {
    const sheet = useCampaignStore.getState().addPrebuiltPlayerSheet({
      name: 'Nova Chen',
      role: 'Medic',
      statLine: 'INT 15',
      tracks: [{ label: 'HP', max: 8 }],
    })!;
    useCampaignStore.getState().setSoloMask(true);

    render(
      <DeskSheetCardBody
        card={{
          id: 'card-pc-1',
          type: 'sheet',
          title: sheet.name,
          targetId: sheet.id,
          x: 0,
          y: 0,
          width: 360,
          height: 420,
          z: 1,
          minimized: false,
          createdAt: 1000,
        }}
        onSelectEntity={vi.fn()}
      />
    );

    expect(screen.queryByTestId('desk-sheet-masked-card-pc-1')).toBeNull();
    expect(screen.getByTestId('desk-player-sheet-card-pc-1-name').textContent).toBe('Nova Chen');
  });
});
