import type {
  PlayerSheetKind,
  PlayerSheetRecord,
  PlayerSheetTrack,
  SheetOverlayColor,
  SheetOverlayKind,
  SheetOverlayRecord,
} from '../storage/types';

export const ALLOWED_IMAGE_SHEET_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export const ALLOWED_IMAGE_SHEET_EXTS = ['.png', '.jpg', '.jpeg', '.webp'] as const;

export interface SheetUploadValidationResult {
  ok: true;
  kind: 'image' | 'pdf';
  mimeType: string;
}

export interface SheetUploadValidationError {
  ok: false;
  error: string;
}

export function validateSheetUploadFile(
  file: { name: string; type?: string },
  expectedKind?: 'image' | 'pdf'
): SheetUploadValidationResult | SheetUploadValidationError {
  const lowerName = (file.name || '').trim().toLowerCase();
  const mime = (file.type || '').trim().toLowerCase();

  const isPdf = mime === 'application/pdf' || lowerName.endsWith('.pdf');
  const isImage =
    ALLOWED_IMAGE_SHEET_MIMES.has(mime) ||
    ALLOWED_IMAGE_SHEET_EXTS.some((ext) => lowerName.endsWith(ext));

  if (expectedKind === 'pdf') {
    if (!isPdf) {
      return {
        ok: false,
        error: 'Please choose a PDF file (.pdf).',
      };
    }
    return {
      ok: true,
      kind: 'pdf',
      mimeType: 'application/pdf',
    };
  }

  if (expectedKind === 'image') {
    if (!isImage) {
      return {
        ok: false,
        error: 'Please choose a PNG, JPG, or WebP image (.png, .jpg, .webp).',
      };
    }
    const inferredMime = ALLOWED_IMAGE_SHEET_MIMES.has(mime)
      ? mime
      : lowerName.endsWith('.webp')
        ? 'image/webp'
        : lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')
          ? 'image/jpeg'
          : 'image/png';
    return {
      ok: true,
      kind: 'image',
      mimeType: inferredMime,
    };
  }

  if (isPdf) {
    return { ok: true, kind: 'pdf', mimeType: 'application/pdf' };
  }
  if (isImage) {
    const inferredMime = ALLOWED_IMAGE_SHEET_MIMES.has(mime)
      ? mime
      : lowerName.endsWith('.webp')
        ? 'image/webp'
        : lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')
          ? 'image/jpeg'
          : 'image/png';
    return { ok: true, kind: 'image', mimeType: inferredMime };
  }

  return {
    ok: false,
    error: 'Unsupported file type. Use .pdf, .png, .jpg, or .webp.',
  };
}

export function stripFileExtension(fileName: string): string {
  const trimmed = fileName.trim();
  const dotIdx = trimmed.lastIndexOf('.');
  if (dotIdx <= 0) return trimmed || 'Character Sheet';
  return trimmed.slice(0, dotIdx).trim() || 'Character Sheet';
}

export function createPlayerSheetId(now = Date.now()): string {
  return `pc-${now}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createPlayerSheetTrackId(now = Date.now()): string {
  return `trk-${now}-${Math.random().toString(36).slice(2, 6)}`;
}

export function clampTrackValues(current: number, max: number): { current: number; max: number } {
  const safeMax = Number.isFinite(max) ? Math.max(1, Math.round(max)) : 1;
  const safeCurrent = Number.isFinite(current)
    ? Math.max(0, Math.min(safeMax, Math.round(current)))
    : 0;
  return { current: safeCurrent, max: safeMax };
}

export function createPrebuiltPlayerSheet(input: {
  id?: string;
  name: string;
  role?: string;
  statLine?: string;
  tracks?: Array<{ id?: string; label: string; current?: number; max: number }>;
  notes?: string;
  now?: number;
}): PlayerSheetRecord {
  const now = input.now ?? Date.now();
  const name = input.name.trim() || 'Unnamed Character';
  const tracks: PlayerSheetTrack[] = (input.tracks ?? [])
    .filter((t) => t.label.trim().length > 0)
    .map((t, idx) => {
      const clamped = clampTrackValues(t.current ?? t.max, t.max);
      return {
        id: t.id?.trim() || `trk-${now}-${idx}`,
        label: t.label.trim(),
        current: clamped.current,
        max: clamped.max,
      };
    });

  return {
    id: input.id?.trim() || createPlayerSheetId(now),
    kind: 'prebuilt',
    name,
    role: input.role?.trim() ?? '',
    statLine: input.statLine?.trim() ?? '',
    tracks,
    notes: input.notes?.trim() ?? '',
    createdAt: now,
    updatedAt: now,
  };
}

export function adjustPlayerSheetTrack(
  tracks: readonly PlayerSheetTrack[],
  trackId: string,
  delta: number
): PlayerSheetTrack[] {
  return tracks.map((track) => {
    if (track.id !== trackId) return track;
    const clamped = clampTrackValues(track.current + delta, track.max);
    return {
      ...track,
      current: clamped.current,
      max: clamped.max,
    };
  });
}

export function updatePlayerSheetTrack(
  tracks: readonly PlayerSheetTrack[],
  trackId: string,
  patch: { label?: string; current?: number; max?: number }
): PlayerSheetTrack[] {
  return tracks.map((track) => {
    if (track.id !== trackId) return track;
    const nextMax = patch.max !== undefined ? patch.max : track.max;
    const nextCurrent = patch.current !== undefined ? patch.current : track.current;
    const clamped = clampTrackValues(nextCurrent, nextMax);
    const nextLabel = patch.label !== undefined ? patch.label.trim() || track.label : track.label;
    return {
      ...track,
      label: nextLabel,
      current: clamped.current,
      max: clamped.max,
    };
  });
}

export function addPlayerSheetTrack(
  tracks: readonly PlayerSheetTrack[],
  input: { label: string; max: number; current?: number; id?: string }
): PlayerSheetTrack[] {
  const label = input.label.trim();
  if (!label) return [...tracks];
  const clamped = clampTrackValues(input.current ?? input.max, input.max);
  return [
    ...tracks,
    {
      id: input.id?.trim() || createPlayerSheetTrackId(),
      label,
      current: clamped.current,
      max: clamped.max,
    },
  ];
}

export function removePlayerSheetTrack(
  tracks: readonly PlayerSheetTrack[],
  trackId: string
): PlayerSheetTrack[] {
  return tracks.filter((t) => t.id !== trackId);
}

export function playerSheetKindLabel(kind: PlayerSheetKind): string {
  switch (kind) {
    case 'pdf':
      return 'PDF';
    case 'image':
      return 'Image';
    case 'prebuilt':
      return 'Prebuilt';
  }
}

export const SHEET_OVERLAY_COLORS: readonly SheetOverlayColor[] = [
  'accent',
  'gold',
  'red',
  'teal',
  'violet',
] as const;

export function clampOverlayPct(pct: number): number {
  if (!Number.isFinite(pct)) return 50;
  const clamped = Math.max(0, Math.min(100, pct));
  return Math.round(clamped * 100) / 100;
}

export function createSheetOverlayId(now = Date.now()): string {
  return `ovl-${now}-${Math.random().toString(36).slice(2, 6)}`;
}

export interface CreateSheetOverlayInput {
  id?: string;
  kind: SheetOverlayKind;
  xPct: number;
  yPct: number;
  page?: number;
  label?: string;
  text?: string;
  active?: boolean;
  value?: number;
  color?: SheetOverlayColor;
  now?: number;
}

export function createSheetOverlay(input: CreateSheetOverlayInput): SheetOverlayRecord {
  const safePage =
    input.page !== undefined && Number.isFinite(input.page)
      ? Math.max(1, Math.round(input.page))
      : undefined;
  const color: SheetOverlayColor =
    input.color && SHEET_OVERLAY_COLORS.includes(input.color) ? input.color : 'accent';

  const base: SheetOverlayRecord = {
    id: input.id?.trim() || createSheetOverlayId(input.now),
    kind: input.kind,
    xPct: clampOverlayPct(input.xPct),
    yPct: clampOverlayPct(input.yPct),
    ...(safePage !== undefined ? { page: safePage } : {}),
    ...(input.label !== undefined ? { label: input.label.trim() } : {}),
    color,
  };

  if (input.kind === 'text') {
    return {
      ...base,
      text: input.text ?? '',
    };
  }
  if (input.kind === 'dot') {
    return {
      ...base,
      active: input.active ?? true,
    };
  }
  return {
    ...base,
    value: Number.isFinite(input.value) ? Math.round(input.value!) : 0,
  };
}

export function addSheetOverlay(
  overlays: readonly SheetOverlayRecord[] | undefined,
  input: CreateSheetOverlayInput
): SheetOverlayRecord[] {
  return [...(overlays ?? []), createSheetOverlay(input)];
}

export function updateSheetOverlay(
  overlays: readonly SheetOverlayRecord[] | undefined,
  overlayId: string,
  patch: Partial<
    Pick<
      SheetOverlayRecord,
      'xPct' | 'yPct' | 'page' | 'label' | 'text' | 'active' | 'value' | 'color'
    >
  >
): SheetOverlayRecord[] {
  return (overlays ?? []).map((overlay) => {
    if (overlay.id !== overlayId) return overlay;
    const next: SheetOverlayRecord = { ...overlay };
    if (patch.xPct !== undefined) next.xPct = clampOverlayPct(patch.xPct);
    if (patch.yPct !== undefined) next.yPct = clampOverlayPct(patch.yPct);
    if (patch.page !== undefined && Number.isFinite(patch.page)) {
      next.page = Math.max(1, Math.round(patch.page));
    }
    if (patch.label !== undefined) next.label = patch.label;
    if (patch.text !== undefined) next.text = patch.text;
    if (patch.active !== undefined) next.active = Boolean(patch.active);
    if (patch.value !== undefined && Number.isFinite(patch.value)) {
      next.value = Math.round(patch.value);
    }
    if (patch.color !== undefined && SHEET_OVERLAY_COLORS.includes(patch.color)) {
      next.color = patch.color;
    }
    return next;
  });
}

export function adjustSheetOverlayCounter(
  overlays: readonly SheetOverlayRecord[] | undefined,
  overlayId: string,
  delta: number
): SheetOverlayRecord[] {
  if (!Number.isFinite(delta)) return [...(overlays ?? [])];
  return (overlays ?? []).map((overlay) => {
    if (overlay.id !== overlayId || overlay.kind !== 'counter') return overlay;
    const current = Number.isFinite(overlay.value) ? overlay.value! : 0;
    return {
      ...overlay,
      value: Math.round(current + delta),
    };
  });
}

export function toggleSheetOverlayDot(
  overlays: readonly SheetOverlayRecord[] | undefined,
  overlayId: string
): SheetOverlayRecord[] {
  return (overlays ?? []).map((overlay) => {
    if (overlay.id !== overlayId || overlay.kind !== 'dot') return overlay;
    return {
      ...overlay,
      active: !(overlay.active ?? false),
    };
  });
}

export function removeSheetOverlay(
  overlays: readonly SheetOverlayRecord[] | undefined,
  overlayId: string
): SheetOverlayRecord[] {
  return (overlays ?? []).filter((o) => o.id !== overlayId);
}

export function getSheetOverlaysForPage(
  overlays: readonly SheetOverlayRecord[] | undefined,
  page: number,
  kind: PlayerSheetKind
): SheetOverlayRecord[] {
  const list = overlays ?? [];
  if (kind !== 'pdf') return [...list];
  const safePage = Number.isFinite(page) ? Math.max(1, Math.round(page)) : 1;
  return list.filter((overlay) => (overlay.page ?? 1) === safePage);
}
