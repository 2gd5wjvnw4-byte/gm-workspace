import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as pdfLib from '../lib/pdf';
import * as soundLib from '../lib/sound';
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

  it('uses a styled 44px popover picker instead of native select, switches sheet, and closes on outside tap or Escape', () => {
    const clickSpy = vi.spyOn(soundLib, 'playTactileClick').mockImplementation(() => {});
    const sheet1 = useCampaignStore.getState().addPrebuiltPlayerSheet({
      name: 'Aria Voss',
      role: 'Pilot',
      tracks: [{ label: 'HP', max: 10 }],
    })!;
    const sheet2 = useCampaignStore.getState().addPrebuiltPlayerSheet({
      name: 'Kael Vance',
      role: 'Engineer',
      tracks: [{ label: 'HP', max: 12 }],
    })!;

    const onSelectEntity = vi.fn();
    const { container } = render(
      <div>
        <button
          type="button"
          data-testid="outside-stop-prop-btn"
          onPointerDown={(e) => e.stopPropagation()}
        >
          Outside
        </button>
        <DeskSheetCardBody
          card={{
            id: 'card-picker-1',
            type: 'sheet',
            title: sheet1.name,
            targetId: sheet1.id,
            x: 0,
            y: 0,
            width: 360,
            height: 420,
            z: 1,
            minimized: false,
            createdAt: 1000,
          }}
          onSelectEntity={onSelectEntity}
        />
      </div>
    );

    // No native <select>
    expect(container.querySelector('select')).toBeNull();

    const trigger = screen.getByTestId('desk-sheet-picker-btn-card-picker-1');
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.style.height).toBe('44px');
    expect(trigger.textContent).toContain('Aria Voss');

    // Open menu
    fireEvent.click(trigger);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    const menu = screen.getByTestId('desk-sheet-picker-menu-card-picker-1');
    expect(menu.getAttribute('role')).toBe('listbox');
    expect(menu.style.maxHeight).toBe('260px');
    expect(menu.style.overflowY).toBe('auto');
    expect(menu.style.touchAction).toBe('pan-y');

    const opt1 = screen.getByTestId(`desk-sheet-picker-option-card-picker-1-${sheet1.id}`);
    const opt2 = screen.getByTestId(`desk-sheet-picker-option-card-picker-1-${sheet2.id}`);
    expect(opt1.getAttribute('role')).toBe('option');
    expect(opt1.getAttribute('aria-selected')).toBe('true');
    expect(opt1.style.minHeight).toBe('44px');
    expect(opt1.style.background).toBe('var(--accentBg)');
    expect(opt2.getAttribute('aria-selected')).toBe('false');
    expect(opt2.style.minHeight).toBe('44px');
    expect(opt2.style.background).toBe('var(--p2)');

    // Outside tap closes in capture phase even when target stops propagation
    fireEvent.pointerDown(screen.getByTestId('outside-stop-prop-btn'));
    expect(screen.queryByTestId('desk-sheet-picker-menu-card-picker-1')).toBeNull();

    // Reopen and close with Escape
    fireEvent.click(trigger);
    expect(screen.getByTestId('desk-sheet-picker-menu-card-picker-1')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('desk-sheet-picker-menu-card-picker-1')).toBeNull();

    // Reopen and select sheet2
    fireEvent.click(trigger);
    fireEvent.click(screen.getByTestId(`desk-sheet-picker-option-card-picker-1-${sheet2.id}`));
    expect(onSelectEntity).toHaveBeenCalledWith(sheet2.id, 'Kael Vance');
    expect(screen.queryByTestId('desk-sheet-picker-menu-card-picker-1')).toBeNull();
    expect(clickSpy).toHaveBeenCalledTimes(4);
  });

  it('masks pinned hidden NPC in picker under Solo Mask while keeping PC sheets selectable', async () => {
    const sheet = useCampaignStore.getState().addPrebuiltPlayerSheet({
      name: 'Nova Chen',
      role: 'Medic',
      tracks: [{ label: 'HP', max: 8 }],
    })!;

    // Import a minimal chunk with an unvisited scene and an NPC in it
    const chunkJson = JSON.stringify({
      meta: { module_id: 'solo-picker-mod', chunk_id: 'act-1', title: 'Solo Mod', act: 1 },
      scenes: [
        { id: 'sc-start', code: 'A1', title: 'Dock', group: 'Bay', entity_ids: [] },
        { id: 'sc-secret', code: 'A2', title: 'Vault', group: 'Bay', entity_ids: ['npc-hidden'] },
      ],
      entities: [
        { id: 'npc-hidden', name: 'Director Vale', type: 'npc', summary: 'Secret villain' },
      ],
    });
    await useCampaignStore.getState().importJsonChunk(chunkJson);
    useCampaignStore.getState().setSoloMask(true);

    const onSelectEntity = vi.fn();
    render(
      <DeskSheetCardBody
        card={{
          id: 'card-solo-1',
          type: 'sheet',
          title: 'Director Vale',
          targetId: 'npc-hidden',
          x: 0,
          y: 0,
          width: 360,
          height: 420,
          z: 1,
          minimized: false,
          createdAt: 1000,
        }}
        onSelectEntity={onSelectEntity}
      />
    );

    const trigger = screen.getByTestId('desk-sheet-picker-btn-card-solo-1');
    expect(trigger.textContent).toContain('???');
    expect(trigger.textContent).toContain('Hidden Character');
    expect(trigger.textContent).not.toContain('Director Vale');
    expect(screen.getByTestId('desk-sheet-masked-card-solo-1')).toBeInTheDocument();

    fireEvent.click(trigger);
    const maskedRow = screen.getByTestId('desk-sheet-picker-masked-option-card-solo-1');
    expect(maskedRow).toBeDisabled();
    expect(maskedRow.textContent).toContain('???');
    expect(screen.queryByTestId('desk-sheet-picker-option-card-solo-1-npc-hidden')).toBeNull();

    const pcOption = screen.getByTestId(`desk-sheet-picker-option-card-solo-1-${sheet.id}`);
    fireEvent.click(pcOption);
    expect(onSelectEntity).toHaveBeenCalledWith(sheet.id, 'Nova Chen');
  });

  it('places, drags, locks, interacts with, zooms, and deletes pinned overlays on an image sheet', async () => {
    const createObjectUrlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-image-sheet');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const sheet = (await useCampaignStore.getState().addFilePlayerSheet({
      kind: 'image',
      name: 'Lyra Image Sheet',
      fileName: 'lyra.png',
      mimeType: 'image/png',
      data: new Uint8Array([137, 80, 78, 71]),
    }))!;

    render(<PlayerSheetView sheetId={sheet.id} testIdPrefix="img-ovl" />);

    const layer = await screen.findByTestId('img-ovl-overlay-layer');
    vi.spyOn(layer, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 200,
      width: 400,
      height: 500,
      right: 500,
      bottom: 700,
      x: 100,
      y: 200,
      toJSON: () => ({}),
    });

    // Enter Edit mode
    const editToggle = screen.getByTestId('img-ovl-overlay-edit-toggle');
    expect(editToggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(editToggle);
    expect(editToggle.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('img-ovl-overlay-toolbar')).toBeInTheDocument();

    // Place a text overlay at (25%, 20%) -> clientX=200, clientY=300
    fireEvent.click(screen.getByTestId('img-ovl-overlay-tool-text'));
    fireEvent.click(layer, { clientX: 200, clientY: 300 });

    // Place a dot overlay at (50%, 50%) -> clientX=300, clientY=450
    fireEvent.click(screen.getByTestId('img-ovl-overlay-tool-dot'));
    fireEvent.click(layer, { clientX: 300, clientY: 450 });

    // Place a counter overlay at (75%, 80%) -> clientX=400, clientY=600
    fireEvent.click(screen.getByTestId('img-ovl-overlay-tool-counter'));
    fireEvent.click(layer, { clientX: 400, clientY: 600 });

    const overlays = useCampaignStore.getState().live?.playerSheets?.[0]?.overlays ?? [];
    expect(overlays).toHaveLength(3);
    const [textPin, dotPin, counterPin] = overlays;
    expect(textPin).toMatchObject({ kind: 'text', xPct: 25, yPct: 20 });
    expect(dotPin).toMatchObject({ kind: 'dot', xPct: 50, yPct: 50, active: true });
    expect(counterPin).toMatchObject({ kind: 'counter', xPct: 75, yPct: 80, value: 0 });

    // Edit selected pin label (including multi-word with space) & color (counterPin is selected)
    fireEvent.change(screen.getByTestId('img-ovl-overlay-label-input'), {
      target: { value: 'Spell ' },
    });
    fireEvent.change(screen.getByTestId('img-ovl-overlay-label-input'), {
      target: { value: 'Spell Slots' },
    });
    fireEvent.click(screen.getByTestId('img-ovl-overlay-color-red'));
    expect(useCampaignStore.getState().live?.playerSheets?.[0]?.overlays?.[2]).toMatchObject({
      label: 'Spell Slots',
      color: 'red',
    });

    // Drag counterPin from (400, 600) to (340, 500) -> (60%, 60%)
    const counterEl = screen.getByTestId(`img-ovl-overlay-${counterPin.id}`);
    fireEvent(
      counterEl,
      new MouseEvent('pointerdown', { bubbles: true, clientX: 400, clientY: 600 })
    );
    fireEvent(
      counterEl,
      new MouseEvent('pointermove', { bubbles: true, clientX: 340, clientY: 500 })
    );
    fireEvent(
      counterEl,
      new MouseEvent('pointerup', { bubbles: true, clientX: 340, clientY: 500 })
    );
    expect(useCampaignStore.getState().live?.playerSheets?.[0]?.overlays?.[2]).toMatchObject({
      xPct: 60,
      yPct: 60,
    });

    // Lock pins
    fireEvent.click(editToggle);
    expect(editToggle.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByTestId('img-ovl-overlay-toolbar')).toBeNull();
    expect(screen.queryByTestId(`img-ovl-overlay-del-${counterPin.id}`)).toBeNull();

    // Dragging while locked must NOT move the pin
    fireEvent(
      counterEl,
      new MouseEvent('pointerdown', { bubbles: true, clientX: 340, clientY: 500 })
    );
    fireEvent(
      counterEl,
      new MouseEvent('pointermove', { bubbles: true, clientX: 150, clientY: 250 })
    );
    fireEvent(
      counterEl,
      new MouseEvent('pointerup', { bubbles: true, clientX: 150, clientY: 250 })
    );
    expect(useCampaignStore.getState().live?.playerSheets?.[0]?.overlays?.[2]).toMatchObject({
      xPct: 60,
      yPct: 60,
    });

    // Play interactions in Locked mode: edit text, toggle dot, step counter
    const textInput = screen.getByTestId(`img-ovl-overlay-text-input-${textPin.id}`);
    fireEvent.change(textInput, { target: { value: 'Lyra Vance' } });
    expect(useCampaignStore.getState().live?.playerSheets?.[0]?.overlays?.[0]?.text).toBe(
      'Lyra Vance'
    );

    const dotBtn = screen.getByTestId(`img-ovl-overlay-dot-${dotPin.id}`);
    expect(dotBtn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(dotBtn);
    expect(dotBtn.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByTestId(`img-ovl-overlay-inc-${counterPin.id}`));
    fireEvent.click(screen.getByTestId(`img-ovl-overlay-inc-${counterPin.id}`));
    fireEvent.click(screen.getByTestId(`img-ovl-overlay-dec-${counterPin.id}`));
    expect(screen.getByTestId(`img-ovl-overlay-val-${counterPin.id}`).textContent).toBe('1');

    // Zoom image sheet -> wrapper scales to 125% and still contains the overlay layer at exact %
    fireEvent.click(screen.getByLabelText('Zoom in image sheet'));
    const surface = screen.getByTestId('img-ovl-image-surface');
    expect(surface.style.width).toBe('125%');
    expect(surface.contains(layer)).toBe(true);
    expect(counterEl.style.left).toBe('60%');
    expect(counterEl.style.top).toBe('60%');

    // Re-enter Edit mode and delete dotPin
    fireEvent.click(editToggle);
    fireEvent.pointerDown(screen.getByTestId(`img-ovl-overlay-${dotPin.id}`), {
      pointerId: 3,
      clientX: 300,
      clientY: 450,
    });
    fireEvent.pointerUp(screen.getByTestId(`img-ovl-overlay-${dotPin.id}`), {
      pointerId: 3,
      clientX: 300,
      clientY: 450,
    });
    fireEvent.click(screen.getByTestId(`img-ovl-overlay-del-${dotPin.id}`));
    expect(useCampaignStore.getState().live?.playerSheets?.[0]?.overlays).toHaveLength(2);

    createObjectUrlSpy.mockRestore();
    revokeSpy.mockRestore();
  });

  it('filters PDF sheet overlays by currentPage and stamps new overlays with currentPage', async () => {
    vi.spyOn(pdfLib, 'loadPdfDocument').mockResolvedValue({
      numPages: 2,
      getPage: vi.fn(),
    } as unknown as pdfLib.PdfDocumentProxy);
    vi.spyOn(pdfLib, 'renderPdfPageToCanvas').mockImplementation(() => ({
      promise: Promise.resolve(),
      cancel: vi.fn(),
    }));

    const sheet = (await useCampaignStore.getState().addFilePlayerSheet({
      kind: 'pdf',
      name: 'Jax PDF Sheet',
      fileName: 'jax.pdf',
      mimeType: 'application/pdf',
      data: new Uint8Array([37, 80, 68, 70]),
      pageCount: 2,
    }))!;

    render(<PlayerSheetView sheetId={sheet.id} testIdPrefix="pdf-ovl" />);

    await waitFor(() => {
      expect(screen.getByTestId('pdf-ovl-pdf-page-readout').textContent).toBe('Page 1 / 2');
    });

    const layer = screen.getByTestId('pdf-ovl-overlay-layer');
    vi.spyOn(layer, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 400,
      right: 200,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    // Place a counter on page 1
    fireEvent.click(screen.getByTestId('pdf-ovl-overlay-edit-toggle'));
    fireEvent.click(screen.getByTestId('pdf-ovl-overlay-tool-counter'));
    fireEvent.click(layer, { clientX: 60, clientY: 100 });

    const page1Overlay = useCampaignStore.getState().live?.playerSheets?.[0]?.overlays?.[0];
    expect(page1Overlay).toMatchObject({ kind: 'counter', page: 1, xPct: 30, yPct: 25 });
    expect(screen.getByTestId(`pdf-ovl-overlay-${page1Overlay!.id}`)).toBeInTheDocument();

    // Switch to page 2 -> page 1 overlay hides
    fireEvent.click(screen.getByTestId('pdf-ovl-pdf-next'));
    await waitFor(() => {
      expect(screen.getByTestId('pdf-ovl-pdf-page-readout').textContent).toBe('Page 2 / 2');
    });
    expect(screen.queryByTestId(`pdf-ovl-overlay-${page1Overlay!.id}`)).toBeNull();

    // Place a dot on page 2 -> stamped with page: 2
    fireEvent.click(screen.getByTestId('pdf-ovl-overlay-tool-dot'));
    fireEvent.click(layer, { clientX: 140, clientY: 300 });

    const overlaysAfter = useCampaignStore.getState().live?.playerSheets?.[0]?.overlays ?? [];
    expect(overlaysAfter).toHaveLength(2);
    expect(overlaysAfter[1]).toMatchObject({ kind: 'dot', page: 2, xPct: 70, yPct: 75 });
    expect(screen.getByTestId(`pdf-ovl-overlay-${overlaysAfter[1].id}`)).toBeInTheDocument();
  });
});
